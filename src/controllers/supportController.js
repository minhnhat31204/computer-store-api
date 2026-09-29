const { SupportConversation, SupportMessage, Product, Category, ProductVariant } = require('../models');

const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const isAdmin = (req) => String(req.body?.role || req.query?.role || '').toLowerCase() === 'admin';

async function findOwnedConversation(req, res) {
  const conversation = await SupportConversation.findByPk(Number(req.params.id));
  if (!conversation) { res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' }); return null; }
  if (isAdmin(req)) return conversation;
  const userId = Number(req.body?.userId || req.query?.userId || 0);
  const visitorKey = clean(req.body?.visitorKey || req.query?.visitorKey, 100);
  const owns = conversation.UserID ? userId === Number(conversation.UserID) : !!visitorKey && visitorKey === conversation.VisitorKey;
  if (!owns) { res.status(403).json({ error: 'Không có quyền truy cập cuộc trò chuyện' }); return null; }
  return conversation;
}

exports.openConversation = async (req, res) => {
  const userId = Number(req.body.userId || 0) || null;
  const visitorKey = clean(req.body.visitorKey, 100) || null;
  if (!userId && !visitorKey) return res.status(400).json({ error: 'Thiếu mã phiên trò chuyện' });
  const where = userId ? { UserID: userId, Status: 'Open' } : { VisitorKey: visitorKey, Status: 'Open' };
  let conversation = await SupportConversation.findOne({ where, order: [['LastMessageAt', 'DESC']] });
  const fields = {
    CustomerName: clean(req.body.name, 150) || 'Khách hàng',
    CustomerEmail: clean(req.body.email, 255) || null,
  };
  if (!conversation) conversation = await SupportConversation.create({ UserID: userId, VisitorKey: userId ? null : visitorKey, ...fields });
  else await conversation.update(fields);
  res.json({ conversation });
};

exports.listConversations = async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Chỉ admin mới xem được hộp thư hỗ trợ' });
  const conversations = await SupportConversation.findAll({ order: [['LastMessageAt', 'DESC']], limit: 200 });
  const items = await Promise.all(conversations.map(async (conversation) => {
    const latest = await SupportMessage.findOne({ where: { ConversationID: conversation.ConversationID }, order: [['CreatedAt', 'DESC']] });
    return { ...conversation.toJSON(), LastMessage: latest?.Message || '', LastSenderRole: latest?.SenderRole || null };
  }));
  res.json(items);
};

exports.getMessages = async (req, res) => {
  const conversation = await findOwnedConversation(req, res);
  if (!conversation) return;
  const messages = await SupportMessage.findAll({ where: { ConversationID: conversation.ConversationID }, order: [['CreatedAt', 'ASC']], limit: 500 });
  res.json({ conversation, messages });
};

exports.sendMessage = async (req, res) => {
  const conversation = await findOwnedConversation(req, res);
  if (!conversation) return;
  const message = clean(req.body.message, 2000);
  if (!message) return res.status(400).json({ error: 'Tin nhắn không được để trống' });
  const admin = isAdmin(req);
  const userId = Number(req.body.userId || 0) || null;
  const sender = await SupportMessage.create({
    ConversationID: conversation.ConversationID,
    SenderUserID: admin ? userId : (conversation.UserID || null),
    SenderRole: admin ? 'Admin' : 'Customer',
    SenderName: clean(req.body.senderName, 150) || (admin ? 'Quản trị viên' : conversation.CustomerName),
    Message: message,
  });
  await conversation.update({ LastMessageAt: sender.CreatedAt });
  res.status(201).json({ message: sender });
};

function normalize(value) {
  return String(value || '').toLocaleLowerCase('vi')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

function extractBudget(context) {
  const normalized = normalize(context);
  const compactAmount = normalized.match(/(?:duoi|toi da|khong qua|ngan sach|tam|khoang)?\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m)\b/);
  if (compactAmount) return Math.round(Number(compactAmount[1].replace(',', '.')) * 1_000_000);
  const vndAmount = normalized.match(/(?:duoi|toi da|khong qua|ngan sach|tam|khoang)?\s*(\d{1,3}(?:[.,]\d{3}){2,})\s*(?:vnd|dong)?\b/);
  if (vndAmount) return Number(vndAmount[1].replace(/[.,]/g, ''));
  return null;
}

function productSearchText(product) {
  return normalize([
    product.ProductName, product.Description, product.Category?.CategoryName,
    product.CPU, product.RAM, product.Storage, product.Display, product.RefreshRate, product.Series,
    ...(product.ProductVariants || []).flatMap((variant) => [variant.Color, variant.Configuration]),
  ].join(' '));
}

function currentProductPrice(product) {
  const regular = Number(product.Price || 0);
  const discounted = Number(product.DiscountPrice || 0);
  return discounted > 0 && (!regular || discounted < regular) ? discounted : regular;
}

function productStock(product) {
  return Number(product.StockQuantity || 0)
    + (product.ProductVariants || []).reduce((sum, variant) => sum + Number(variant.StockQuantity || 0), 0);
}

function findRelevantProducts(context, products, budgetVnd = null) {
  const stopWords = new Set(['cho', 'toi', 'minh', 'ban', 'co', 'khong', 'nao', 'gia', 'bao', 'nhieu', 'may', 'tinh', 'laptop', 'hang', 'san', 'pham', 'loai', 'con', 'tu', 'duoi', 'tren', 'voi', 'va', 'la', 'cua', 'the', 'nhe', 'ad', 'shop', 'ben', 'manb', 'muon', 'can', 'dang', 'la', 'mot', 'cac', 'voi', 'gi', 'thi']);
  const normalizedContext = normalize(context);
  const tokens = normalizedContext.split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !stopWords.has(token) && !/^\d+$/.test(token));
  const useCases = [
    { name: 'chơi game', words: ['gaming', 'game', 'fps', 'choi game'] },
    { name: 'học tập và văn phòng', words: ['hoc tap', 'van phong', 'office', 'word', 'excel'] },
    { name: 'lập trình', words: ['lap trinh', 'code', 'programming', 'developer'] },
    { name: 'thiết kế và đồ họa', words: ['do hoa', 'photoshop', 'premiere', 'render', 'edit video'] },
    { name: 'di chuyển nhiều', words: ['mang theo', 'di chuyen', 'mong nhe', 'pin lau'] },
  ];
  const matchedUseCases = useCases.filter((item) => item.words.some((word) => normalizedContext.includes(normalize(word))));
  const ranked = products.map((product) => {
    const searchable = productSearchText(product);
    const name = normalize(product.ProductName);
    let score = tokens.reduce((total, token) => total + (searchable.includes(token) ? (name.includes(token) ? 4 : 1) : 0), 0);
    for (const useCase of matchedUseCases) {
      if (useCase.words.some((word) => searchable.includes(normalize(word)))) score += 2;
    }
    const price = currentProductPrice(product);
    const variantAvailable = (product.ProductVariants || []).some((variant) => Number(variant.StockQuantity || 0) > 0);
    const available = Number(product.StockQuantity || 0) > 0 || variantAvailable;
    if (available) score += 0.5;
    if (budgetVnd) score += price <= budgetVnd ? 3 : Math.max(-5, -((price - budgetVnd) / budgetVnd) * 3);
    return { product, score, available, price };
  }).sort((a, b) => b.score - a.score || Number(b.available) - Number(a.available));
  let selected;
  if (budgetVnd) {
    const inBudgetAndAvailable = ranked.filter((row) => row.available && row.price <= budgetVnd).slice(0, 14);
    const exactOverBudgetMatches = ranked.filter((row) => row.price > budgetVnd && row.score >= 4).slice(0, 4);
    selected = inBudgetAndAvailable.length
      ? [...inBudgetAndAvailable, ...exactOverBudgetMatches]
      : ranked.filter((row) => row.score > 0).slice(0, 18);
  } else {
    const matches = ranked.filter((row) => row.score > 0).slice(0, 16);
    selected = matches.length ? matches : ranked.slice(0, 10);
  }
  return selected.map(({ product, available, price }) => ({
    id: product.ProductID,
    name: product.ProductName,
    category: product.Category?.CategoryName || null,
    description: clean(product.Description, 600),
    priceVnd: price,
    originalPriceVnd: Number(product.Price || 0),
    stockQuantity: Number(product.StockQuantity || 0),
    availableNow: available,
    cpu: product.CPU || null,
    ram: product.RAM || null,
    storage: product.Storage || null,
    display: product.Display || null,
    refreshRate: product.RefreshRate || null,
    series: product.Series || null,
    variants: (product.ProductVariants || []).map((variant) => ({
      color: variant.Color || null,
      configuration: variant.Configuration || null,
      priceVnd: Number(variant.Price || 0),
      stockQuantity: Number(variant.StockQuantity || 0),
    })),
  }));
}

function findCatalogMatches(question, products) {
  const stopWords = new Set(['cho', 'toi', 'minh', 'ban', 'co', 'khong', 'nao', 'gia', 'bao', 'nhieu', 'may', 'tinh', 'laptop', 'hang', 'san', 'pham', 'loai', 'con', 'tu', 'duoi', 'tren', 'voi', 'va', 'la', 'cua', 'the', 'nhe', 'ad', 'shop', 'ben', 'manb']);
  const tokens = normalize(question).split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !stopWords.has(token) && !/^\d+$/.test(token) && !['trieu', 'tr', 'm', 'vnd', 'dong'].includes(token));
  if (!tokens.length) return [];
  return products.map((product) => {
    const searchable = normalize([
      product.ProductName, product.Description, product.Category?.CategoryName,
      product.CPU, product.RAM, product.Storage, product.Display, product.RefreshRate, product.Series,
    ].join(' '));
    const score = tokens.reduce((total, token) => total + (searchable.includes(token) ? 1 : 0), 0);
    return { product, score };
  }).filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.product.StockQuantity || 0) - Number(a.product.StockQuantity || 0))
    .slice(0, 5).map(({ product }) => product);
}

function buildCatalogFallback(question, products) {
  const normalized = normalize(question);
  const budget = extractBudget(question);
  const useCases = [
    { name: 'học tập/văn phòng', words: ['hoc tap', 'van phong', 'office', 'word', 'excel'] },
    { name: 'lập trình', words: ['lap trinh', 'code', 'programming', 'developer'] },
    { name: 'chơi game', words: ['gaming', 'game', 'fps', 'choi game'] },
    { name: 'thiết kế/đồ họa', words: ['do hoa', 'photoshop', 'premiere', 'render', 'edit video'] },
    { name: 'di chuyển nhiều', words: ['mang theo', 'di chuyen', 'mong nhe', 'pin lau'] },
  ];
  const useCase = useCases.find((item) => item.words.some((word) => normalized.includes(normalize(word))));
  const directMatches = findCatalogMatches(question, products);
  const explicitConsultation = /(tu van|goi y|nen mua|phu hop|tim laptop|laptop nao|chay duoc|dung cho)/.test(normalized);
  const recommendationIntent = explicitConsultation || !!useCase || (!!budget && !directMatches.length);
  if (recommendationIntent && !useCase) return 'Để tư vấn đúng nhu cầu, bạn dùng máy chủ yếu cho việc gì: học tập/văn phòng, lập trình, chơi game hay thiết kế/đồ họa?';
  if (recommendationIntent && useCase && !budget) return `Mình sẽ chọn theo nhu cầu ${useCase.name}. Bạn dự định chi tối đa khoảng bao nhiêu để mình lọc đúng tầm giá?`;

  if (recommendationIntent && useCase && budget) {
    const inStockProducts = products.filter((product) => productStock(product) > 0);
    const inBudgetProducts = inStockProducts.filter((product) => currentProductPrice(product) <= budget);
    const candidatePool = inBudgetProducts.length
      ? inBudgetProducts
      : inStockProducts.slice().sort((a, b) => currentProductPrice(a) - currentProductPrice(b)).slice(0, 12);
    const relevant = findRelevantProducts(question, candidatePool, budget);
    const available = relevant.filter((product) => product.availableNow);
    const withinBudget = available.filter((product) => product.priceVnd <= budget);
    const picks = (withinBudget.length ? withinBudget : available).slice(0, 2);
    if (!picks.length) {
      const cheapest = inStockProducts.slice().sort((a, b) => currentProductPrice(a) - currentProductPrice(b))[0];
      if (!cheapest) return 'Hiện catalog không có mẫu nào còn hàng. Mình có thể chuyển hội thoại cho nhân viên kiểm tra thêm.';
      return `Mình chưa thấy mẫu còn hàng trong ngân sách ${budget.toLocaleString('vi-VN')} ₫. Mẫu có giá thấp nhất hiện tại là ${cheapest.ProductName} — ${currentProductPrice(cheapest).toLocaleString('vi-VN')} ₫. Bạn muốn tăng ngân sách hay đổi ưu tiên sử dụng?`;
    }
    const details = picks.map((product, index) => {
      const specs = [product.cpu && `CPU ${product.cpu}`, product.ram && `RAM ${product.ram}`, product.storage && `ổ ${product.storage}`].filter(Boolean).join(', ');
      const variantStock = product.variants.filter((variant) => variant.stockQuantity > 0);
      const stockText = product.stockQuantity > 0 ? `còn ${product.stockQuantity} máy` : `còn biến thể ${variantStock.map((variant) => `${variant.color || variant.configuration || 'tùy chọn'} (${variant.stockQuantity})`).join(', ')}`;
      const gpuCaveat = useCase.name === 'chơi game' && !/rtx|gtx|radeon|arc\s*a\d/i.test(`${product.description || ''} ${product.name}`)
        ? ' Catalog chưa có thông tin GPU nên mình chưa thể xác nhận hiệu năng game nặng.' : '';
      const reason = specs ? `Mẫu này ${product.priceVnd <= budget ? 'nằm trong ngân sách' : 'vượt ngân sách một chút'}; cấu hình ghi ${specs}.` : 'Catalog chưa có đủ thông số để giải thích mức phù hợp.';
      return `${index === 0 ? 'Mình ưu tiên' : 'Có thể cân nhắc thêm'}: ${product.name} — ${Number(product.priceVnd).toLocaleString('vi-VN')} ₫, ${stockText}. ${reason}${gpuCaveat}`;
    });
    const budgetNote = withinBudget.length ? '' : `Mình chưa thấy mẫu còn hàng trong ngân sách ${budget.toLocaleString('vi-VN')} ₫; gợi ý gần nhất đang vượt ngân sách.\n`;
    return `${budgetNote}${details.join('\n')}\nBạn muốn ưu tiên hiệu năng hay máy nhẹ/dễ mang theo hơn?`;
  }

  const matchingProducts = directMatches;
  if (!matchingProducts.length && !budget) {
    return 'Mình chưa tìm được mẫu phù hợp trong catalog. Bạn cho mình biết tên/model cần tìm, hoặc nhu cầu sử dụng và ngân sách để mình tra sát hơn nhé.';
  }

  const matchingAvailable = matchingProducts.filter((product) => productStock(product) > 0);
  const allAvailable = products.filter((product) => productStock(product) > 0);
  const allAffordable = budget ? allAvailable.filter((product) => currentProductPrice(product) <= budget) : [];
  const matchingWithinBudget = budget ? matchingAvailable.filter((product) => currentProductPrice(product) <= budget) : matchingAvailable;
  let chosen;
  let intro;
  if (budget && allAffordable.length) {
    const pool = matchingWithinBudget.length ? matchingWithinBudget : allAffordable;
    chosen = findRelevantProducts(question, pool, budget).slice(0, 3);
    intro = matchingWithinBudget.length
      ? `Các mẫu khớp từ khóa và còn hàng trong ngân sách tối đa ${budget.toLocaleString('vi-VN')} ₫:`
      : `Mẫu khớp từ khóa hiện vượt ngân sách, nhưng catalog có các lựa chọn khác còn hàng dưới ${budget.toLocaleString('vi-VN')} ₫:`;
  } else if (budget) {
    const nearest = matchingAvailable.length ? matchingAvailable : allAvailable;
    chosen = nearest.slice().sort((a, b) => currentProductPrice(a) - currentProductPrice(b)).slice(0, 3);
    intro = `Chưa có mẫu nào còn hàng dưới ${budget.toLocaleString('vi-VN')} ₫. Đây là các mẫu giá thấp nhất hiện có:`;
  } else {
    chosen = (matchingAvailable.length ? matchingAvailable : matchingProducts).slice(0, 3);
    intro = matchingAvailable.length ? 'Mình tìm thấy các mẫu khớp từ khóa và đang còn hàng:' : 'Các mẫu khớp từ khóa hiện đang hết hàng:';
  }
  if (!chosen.length) return 'Hiện catalog không có sản phẩm phù hợp. Bạn có thể chuyển sang nhân viên hỗ trợ để kiểm tra thêm.';
  const details = chosen.map((product) => {
    const stock = productStock(product);
    const price = currentProductPrice(product).toLocaleString('vi-VN');
    const availableVariants = (product.ProductVariants || []).filter((variant) => Number(variant.StockQuantity || 0) > 0);
    const stockText = Number(product.StockQuantity || 0) > 0 ? `còn ${product.StockQuantity} sản phẩm` : availableVariants.length
      ? `còn biến thể ${availableVariants.map((variant) => `${variant.Color || variant.Configuration || 'tùy chọn'} (${variant.StockQuantity})`).join(', ')}`
      : stock > 0 ? 'còn hàng theo biến thể' : 'đang hết hàng';
    const specs = [product.CPU && `CPU ${product.CPU}`, product.RAM && `RAM ${product.RAM}`, product.Storage && `ổ ${product.Storage}`].filter(Boolean).join(', ');
    return `• ${product.ProductName} — ${stockText}; ${price} ₫${specs ? `; ${specs}` : ''}`;
  });
  return `${intro}\n${details.join('\n')}\n\nBạn định dùng máy cho việc gì và muốn giữ ngân sách tối đa bao nhiêu? Mình sẽ lọc kỹ hơn theo tiêu chí đó.`;
}

exports.aiReply = async (req, res) => {
  const conversation = await findOwnedConversation(req, res);
  if (!conversation) return;
  const apiKey = process.env.OPENAI_API_KEY;

  const latestCustomerMessage = await SupportMessage.findOne({
    where: { ConversationID: conversation.ConversationID, SenderRole: 'Customer' },
    order: [['CreatedAt', 'DESC']],
  });
  if (!latestCustomerMessage) return res.status(400).json({ error: 'Chưa có câu hỏi để AI trả lời' });

  const [history, products] = await Promise.all([
    SupportMessage.findAll({ where: { ConversationID: conversation.ConversationID }, order: [['CreatedAt', 'DESC']], limit: 16 }),
    Product.findAll({ include: [{ model: Category }, { model: ProductVariant }] }),
  ]);
  const chronologicalHistory = history.slice().reverse();
  const recentCustomerContext = chronologicalHistory
    .filter((message) => message.SenderRole === 'Customer')
    .slice(-8).map((message) => message.Message).join('\n');
  const budgetVnd = extractBudget(recentCustomerContext);

  if (!apiKey) {
    const assistantMessage = await SupportMessage.create({
      ConversationID: conversation.ConversationID,
      SenderUserID: null,
      SenderRole: 'AI',
      SenderName: 'Trợ lý mua sắm MANB',
      Message: buildCatalogFallback(recentCustomerContext || latestCustomerMessage.Message, products),
    });
    await conversation.update({ LastMessageAt: assistantMessage.CreatedAt });
    return res.status(201).json({ message: assistantMessage, fallback: true });
  }

  const relevantProducts = findRelevantProducts(recentCustomerContext || latestCustomerMessage.Message, products, budgetVnd);
  const previousTurns = chronologicalHistory.filter((message) => message.MessageID !== latestCustomerMessage.MessageID)
    .map((message) => `${message.SenderRole === 'Customer' ? 'Khách' : message.SenderRole === 'AI' ? 'Trợ lý AI' : 'Nhân viên'}: ${message.Message}`)
    .join('\n');
  const instructions = [
    'Bạn là nhân viên tư vấn bán hàng máy tính của MANB.VN, không phải công cụ đọc danh sách. Trò chuyện bằng tiếng Việt tự nhiên, thân thiện, như đang tư vấn trực tiếp.',
    'Mục tiêu là hiểu nhu cầu rồi giúp khách chọn. Dùng các tin nhắn trước để nhớ mục đích sử dụng, ngân sách, thương hiệu và ưu tiên; đừng hỏi lại điều khách đã nói.',
    'Nếu khách chỉ hỏi một việc tra cứu cụ thể như một mẫu còn hàng không, trả lời thẳng câu đó trước. Nếu khách cần chọn máy nhưng chưa nói mục đích sử dụng, hãy hỏi một câu ngắn về việc họ làm (học/văn phòng, lập trình, game, đồ họa...). Khi đã rõ mục đích mà chưa biết ngân sách, hỏi ngân sách tối đa. Mỗi lượt chỉ hỏi tối đa một câu làm rõ quan trọng.',
    'Khi đã đủ thông tin, đưa ra một lựa chọn phù hợp nhất và tối đa một phương án thay thế. Giải thích cụ thể cấu hình nào đáp ứng nhu cầu nào, nêu điểm đánh đổi và hỏi khách muốn ưu tiên điều gì tiếp theo. Không liệt kê hàng loạt tên sản phẩm hoặc kết thúc bằng lời mời chung chung.',
    'Chỉ dùng sản phẩm trong catalog được cung cấp. Giá đang bán là priceVnd. Tồn kho parent bằng 0 là hết hàng trừ khi một biến thể có tồn riêng lớn hơn 0; khi đó nói rõ biến thể nào còn. Không bịa giá, tồn kho, GPU, thời lượng pin, trọng lượng, bảo hành, ưu đãi hay chính sách nếu dữ liệu không có.',
    'Nếu tư vấn game/đồ họa nhưng dữ liệu không có GPU, nói rõ chưa đủ dữ liệu để đảm bảo hiệu năng tác vụ đó và hỏi khách hoặc chuyển nhân viên xác nhận. Không khẳng định cấu hình phù hợp chỉ từ thương hiệu hoặc tên dòng.',
    'Nếu ngân sách khách nêu ra thấp hơn giá mọi mẫu còn hàng, nói rõ chưa có lựa chọn đúng ngân sách; chỉ nêu một mẫu vượt ngân sách gần nhất nếu hữu ích và ghi rõ phần vượt.',
    'Nếu câu hỏi ngoài dữ liệu cửa hàng, thành thật nói chưa xác minh được và mời chuyển cho nhân viên. Không giả vờ đã kiểm tra thông tin không được cung cấp.',
  ].join(' ');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        store: false,
        instructions,
        input: [
          { role: 'user', content: `Thông tin nhu cầu đã nêu ở các lượt gần đây:\n${recentCustomerContext || '(chưa có)'}\n\nNgân sách nhận diện được (VND): ${budgetVnd || 'chưa nêu'}\n\nDữ liệu sản phẩm được truy vấn từ database hiện tại (JSON):\n${JSON.stringify(relevantProducts)}\n\nCác lượt hội thoại gần đây:\n${previousTurns || '(chưa có)'}\n\nTin nhắn mới nhất của khách:\n${latestCustomerMessage.Message}` },
        ],
        max_output_tokens: 500,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('AI provider error:', response.status, result?.error?.message || 'Unknown provider error');
      return res.status(502).json({ error: 'Trợ lý AI đang bận. Bạn có thể nhắn trực tiếp với bộ phận chăm sóc khách hàng.' });
    }
    const answer = (result.output || []).flatMap((item) => item.content || [])
      .filter((item) => item.type === 'output_text').map((item) => item.text).join('\n').trim();
    if (!answer) return res.status(502).json({ error: 'AI chưa tạo được câu trả lời. Bạn có thể nhắn trực tiếp với bộ phận chăm sóc khách hàng.' });
    const assistantMessage = await SupportMessage.create({
      ConversationID: conversation.ConversationID,
      SenderUserID: null,
      SenderRole: 'AI',
      SenderName: 'Trợ lý MANB AI',
      Message: answer.slice(0, 2000),
    });
    await conversation.update({ LastMessageAt: assistantMessage.CreatedAt });
    res.status(201).json({ message: assistantMessage });
  } catch (error) {
    console.error('AI assistant request failed:', error.message);
    res.status(502).json({ error: 'Không kết nối được trợ lý AI. Bạn có thể nhắn trực tiếp với bộ phận chăm sóc khách hàng.' });
  } finally {
    clearTimeout(timeout);
  }
};
