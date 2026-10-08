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
  return String(value || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

function extractBudget(context) {
  const normalized = normalize(context);
  const compactAmount = normalized.match(/(?:duoi|toi da|khong qua|ngan sach|tam|khoang|tam khoang|gia)?\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|cu)\b/);
  if (compactAmount) return Math.round(Number(compactAmount[1].replace(',', '.')) * 1_000_000);
  const vndAmount = normalized.match(/(?:duoi|toi da|khong qua|ngan sach|tam|khoang|tam khoang|gia)?\s*(\d{1,3}(?:[.,]\d{3}){2,})\s*(?:vnd|dong|d)?\b/);
  if (vndAmount) return Number(vndAmount[1].replace(/[.,]/g, ''));
  return null;
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

function productSearchText(product) {
  return normalize([
    product.ProductName, product.Description, product.Category?.CategoryName,
    product.CPU, product.RAM, product.Storage, product.Display, product.RefreshRate, product.Series,
    ...(product.ProductVariants || []).flatMap((variant) => [variant.Color, variant.Configuration]),
  ].join(' '));
}

// Trợ lý chuyên gia tư vấn máy tính thông minh (Smart Vietnamese Consultation Engine)
function buildSmartAdvice(question, products, history = []) {
  const norm = normalize(question);
  const budget = extractBudget(question);

  // 1. Phản hồi chào hỏi thân thiện
  const isGreeting = /^(chao|xin chao|hello|hi|alo|shop oi|ad oi|co ai khong|admin oi)\b/.test(norm);
  if (isGreeting && norm.length < 25) {
    return 'Dạ MANB SHOP xin chào quý khách! 👋\n\nEm là trợ lý AI chuyên tư vấn laptop & máy tính. Em có thể hỗ trợ anh/chị chọn máy theo:\n' +
      '• 🎮 Laptop Gaming (chơi mượt Valorant, LOL, FO4, GTA V, Black Myth Wukong...)\n' +
      '• 💻 Laptop Sinh viên / Văn phòng (mỏng nhẹ, pin trâu, mượt Word/Excel)\n' +
      '• 🎨 Laptop Đồ họa / Kỹ thuật / Lập trình (màn đẹp, CPU mạnh, RAM 16GB-32GB)\n' +
      '• 🍎 MacBook / Ultrabook cao cấp\n\n' +
      'Anh/chị đang tìm máy tầm giá khoảng bao nhiêu hoặc dùng cho công việc gì để em tư vấn mẫu phù hợp nhất ạ?';
  }

  // 2. Câu hỏi về chính sách cửa hàng
  if (/(bao hanh|doi tra|loi)/.test(norm)) {
    return 'Dạ về chính sách bảo hành tại MANB SHOP:\n' +
      '• Toàn bộ sản phẩm được bảo hành chính hãng từ 12 đến 24 tháng theo tiêu chuẩn nhà sản xuất.\n' +
      '• Hỗ trợ 1 đổi 1 trong vòng 30 ngày nếu phát sinh lỗi phần cứng từ nhà sản xuất.\n' +
      '• Miễn phí cài đặt phần mềm, vệ sinh máy trọn đời tại các showroom.\n' +
      'Anh/chị cần kiểm tra thông tin bảo hành của sản phẩm nào không ạ?';
  }

  if (/(ship|giao hang|phi van chuyen|van chuyen|cod|nhan hang)/.test(norm)) {
    return 'Dạ về chính sách giao hàng tại MANB SHOP:\n' +
      '• Miễn phí giao hàng toàn quốc (Freeship) cho mọi đơn hàng từ 1.000.000 ₫.\n' +
      '• Giao hỏa tốc 2 giờ tại khu vực nội thành TP.HCM.\n' +
      '• Các tỉnh thành khác nhận hàng từ 2 - 4 ngày làm việc.\n' +
      '• Quý khách được quyền mở hộp kiểm tra máy trước khi thanh toán (hỗ trợ COD đầy đủ).';
  }

  if (/(tra gop|thanh toan|payos|chuyen khoan)/.test(norm)) {
    return 'Dạ MANB SHOP hỗ trợ đa dạng phương thức thanh toán linh hoạt:\n' +
      '• Thanh toán trực tiếp khi nhận hàng (COD).\n' +
      '• Chuyển khoản ngân hàng quét mã VietQR / PayOS tự động xác nhận sau 3 giây.\n' +
      '• Trả góp 0% lãi suất qua thẻ tín dụng hoặc các đối tác tài chính uy tín.';
  }

  // 3. Phân tích tác vụ & nhu cầu chi tiết
  const isGaming = /(game|gaming|fps|valorant|lol|lien minh|fo4|fifa|gta|wukong|genshin|cs2|pubg|dota|steam)/.test(norm);
  const isCoding = /(lap trinh|code|cntt|developer|dev|java|python|c\+\+|docker|visual studio|vscode|it)/.test(norm);
  const isGraphic = /(do hoa|photoshop|illustrator|premiere|video|render|autocad|3ds|revit|capcut|canva|chuan mau|srgb)/.test(norm);
  const isOffice = /(van phong|hoc tap|sinh vien|ke toan|word|excel|mong nhe|pin trau|nhe)/.test(norm);
  const isMac = /(macbook|apple|m1|m2|m3|macos)/.test(norm);

  // 4. Lọc & xếp hạng sản phẩm thông minh từ Database
  const scoredProducts = products.map((product) => {
    const text = productSearchText(product);
    const price = currentProductPrice(product);
    const inStock = productStock(product) > 0;
    let score = 0;

    // Khớp từ khóa tìm kiếm trực tiếp
    const tokens = norm.split(/[^a-z0-9]+/).filter((t) => t.length > 1);
    tokens.forEach((t) => {
      if (text.includes(t)) score += 2;
      if (normalize(product.ProductName).includes(t)) score += 5;
    });

    // Điểm theo nhu cầu
    if (isGaming) {
      if (/gaming|rog|tuf|nitro|legion|victus|loq|rtx|gtx|144hz|165hz/i.test(text)) score += 8;
      if (/rtx\s*40|rtx\s*30/i.test(text)) score += 5;
    }
    if (isCoding) {
      if (/16gb|32gb|i7|i5|ryzen 7|ryzen 5|512gb|1tb/i.test(text)) score += 6;
    }
    if (isGraphic) {
      if (/rtx|oled|ips|100% srgb|retina|macbook/i.test(text)) score += 7;
    }
    if (isOffice) {
      if (/zenbook|vivobook|swift|ideapad|envy|gram|macbook|mong nhe/i.test(text)) score += 6;
    }
    if (isMac) {
      if (/macbook|apple|m1|m2|m3/i.test(text)) score += 12;
    }

    // Điểm theo ngân sách
    if (budget) {
      if (price <= budget) score += 6;
      else if (price <= budget * 1.15) score += 2;
      else score -= 4;
    }

    if (inStock) score += 3;

    return { product, score, price, inStock };
  });

  scoredProducts.sort((a, b) => b.score - a.score);

  const bestMatches = scoredProducts.filter((item) => item.score > 2).slice(0, 3);
  const fallbackMatches = (scoredProducts.filter((item) => item.inStock).length > 0 ? scoredProducts.filter((item) => item.inStock) : scoredProducts).slice(0, 3);
  const chosenList = bestMatches.length > 0 ? bestMatches : fallbackMatches;

  if (!chosenList.length) {
    return 'Dạ hiện tại danh mục chưa có sản phẩm khớp với yêu cầu này. Anh/chị có thể cho em xin tầm giá hoặc thương hiệu mong muốn để em tra cứu các mẫu tương tự nhé!';
  }

  // 5. Soạn câu tư vấn chuyên gia sắc sảo
  let responseText = '';
  
  if (budget) {
    responseText += `Dạ với ngân sách khoảng ${budget.toLocaleString('vi-VN')} ₫`;
    if (isGaming) responseText += ' để chơi game mượt mà';
    else if (isCoding) responseText += ' cho nhu cầu học lập trình / CNTT';
    else if (isGraphic) responseText += ' cho công việc thiết kế đồ họa / render';
    else if (isOffice) responseText += ' phục vụ học tập, văn phòng mỏng nhẹ';
    responseText += ', em xin đề xuất các lựa chọn tối ưu nhất đang có sẵn tại shop:\n\n';
  } else if (isGaming) {
    responseText += 'Dạ đối với nhu cầu chơi game (Esport & AAA), em tư vấn anh/chị các mẫu Laptop Gaming cấu hình mạnh, tản nhiệt mát và tần số quét cao:\n\n';
  } else if (isCoding) {
    responseText += 'Dạ cho nhu cầu học tập lập trình & công nghệ thông tin (cần CPU khỏe, RAM 16GB+ chạy đa nhiệm mượt), các mẫu tốt nhất hiện có gồm:\n\n';
  } else if (isGraphic) {
    responseText += 'Dạ với nhu cầu thiết kế đồ họa, chỉnh sửa ảnh/video (cần màn hình chuẩn màu và card đồ họa tốt), em gợi ý các mẫu nổi bật:\n\n';
  } else if (isOffice) {
    responseText += 'Dạ phục vụ học tập và công việc văn phòng (ưu tiên mỏng nhẹ, pin trâu, phím êm), anh/chị tham khảo ngay các mẫu này nhé:\n\n';
  } else {
    responseText += 'Dạ em đã tìm thấy các mẫu laptop rất phù hợp với nhu cầu của anh/chị tại MANB SHOP:\n\n';
  }

  chosenList.forEach(({ product, price, inStock }, idx) => {
    const specs = [
      product.CPU && `CPU: ${product.CPU}`,
      product.RAM && `RAM: ${product.RAM}`,
      product.Storage && `Ổ cứng: ${product.Storage}`,
      product.Display && `Màn hình: ${product.Display}`,
      product.RefreshRate && `Tần số quét: ${product.RefreshRate}`,
    ].filter(Boolean).join(' | ');

    const stockStr = inStock ? '✅ Còn hàng' : '⏳ Tạm hết hàng';
    const num = idx + 1;
    responseText += `🔹 **${num}. ${product.ProductName}**\n`;
    responseText += `   • Giá bán: **${price.toLocaleString('vi-VN')} ₫** ${product.DiscountPrice && product.Price > product.DiscountPrice ? `(Giảm từ ${Number(product.Price).toLocaleString('vi-VN')} ₫)` : ''}\n`;
    if (specs) responseText += `   • Cấu hình: ${specs}\n`;
    responseText += `   • Tình trạng: ${stockStr}\n`;
    
    // Đánh giá điểm mạnh
    if (isGaming || /gaming|rtx|gtx|144hz/i.test(productSearchText(product))) {
      responseText += `   • Đánh giá: Chơi mượt các tựa game Esport (Valorant, LOL, FO4) và chiến tốt game 3D với FPS ổn định.\n`;
    } else if (isCoding || /16gb|i7|ryzen 7/i.test(productSearchText(product))) {
      responseText += `   • Đánh giá: Đa nhiệm tốt, mở nhiều tab & chạy mượt VS Code, Docker, Android Studio không lo giật lag.\n`;
    } else {
      responseText += `   • Đánh giá: Thiết kế hiện đại, hiệu năng ổn định, khởi động máy và mở ứng dụng cực nhanh.\n`;
    }
    responseText += '\n';
  });

  responseText += 'Anh/chị cần em tư vấn kỹ hơn về mẫu nào hoặc muốn hỗ trợ đặt hàng giao hỏa tốc không ạ? 😊';

  return responseText;
}

exports.aiReply = async (req, res) => {
  const conversation = await findOwnedConversation(req, res);
  if (!conversation) return;

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
    .filter((m) => m.SenderRole === 'Customer')
    .slice(-6).map((m) => m.Message).join('\n');

  const budgetVnd = extractBudget(recentCustomerContext || latestCustomerMessage.Message);
  const relevantProducts = products.map((p) => ({
    id: p.ProductID,
    name: p.ProductName,
    price: currentProductPrice(p),
    originalPrice: Number(p.Price || 0),
    stock: productStock(p),
    cpu: p.CPU || '',
    ram: p.RAM || '',
    storage: p.Storage || '',
    display: p.Display || '',
    refreshRate: p.RefreshRate || '',
    series: p.Series || '',
    category: p.Category?.CategoryName || '',
    description: clean(p.Description, 400),
  }));

  const systemPrompt = `Bạn là Chuyên gia Tư vấn Bán hàng Laptop & Máy tính cao cấp của MANB.VN (MANB SHOP).
Phong cách: Nhiệt tình, thân thiện, am hiểu kỹ thuật chuyên sâu nhưng diễn đạt dễ hiểu, sử dụng tiếng Việt tự nhiên và xưng hô 'em' - 'anh/chị' hoặc 'quý khách'.

Nhiệm vụ:
1. Đọc hiểu nhu cầu khách hàng (học tập, lập trình, game, đồ họa, ngân sách, thương hiệu).
2. Dựa vào DANH SÁCH SẢN PHẨM THỰC TẾ dưới đây của cửa hàng để đưa ra tư vấn:
${JSON.stringify(relevantProducts.slice(0, 25), null, 2)}

Nguyên tắc:
- Báo đúng tên máy, giá tiền (VND), cấu hình và tình trạng còn hàng theo dữ liệu trên.
- Giải thích vì sao cấu hình đó đáp ứng tốt nhu cầu (ví dụ: cần RAM 16GB để code/render, cần RTX để chơi game nặng, màn hình chuẩn màu làm đồ họa).
- Đưa ra 2 đến 3 gợi ý tốt nhất có gạch đầu dòng rõ ràng, kèm lời khuyên chân thành.
- Nếu khách hỏi ngoài danh mục hoặc hỏi chính sách: MANB SHOP bảo hành chính hãng 12-24 tháng, 1 đổi 1 30 ngày, freeship toàn quốc, có COD và trả góp.`;

  // 1. Thử gọi Google Gemini API nếu có cấu hình
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
      const geminiPayload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\nLịch sử trò chuyện gần đây:\n${chronologicalHistory.map(m => `${m.SenderRole}: ${m.Message}`).join('\n')}\n\nKhách hàng hỏi: "${latestCustomerMessage.Message}"\nHãy trả lời khách hàng:` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        }
      };

      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      });

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          const assistantMessage = await SupportMessage.create({
            ConversationID: conversation.ConversationID,
            SenderUserID: null,
            SenderRole: 'AI',
            SenderName: 'Trợ lý MANB AI',
            Message: text.trim().slice(0, 3000),
          });
          await conversation.update({ LastMessageAt: assistantMessage.CreatedAt });
          return res.status(201).json({ message: assistantMessage });
        }
      }
    } catch (geminiErr) {
      console.warn('Gemini API call failed, falling back:', geminiErr.message);
    }
  }

  // 2. Thử gọi OpenAI API nếu có cấu hình
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (openAiApiKey) {
    try {
      const openAiUrl = 'https://api.openai.com/v1/chat/completions';
      const openAiRes = await fetch(openAiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...chronologicalHistory.slice(-8).map((m) => ({
              role: m.SenderRole === 'Customer' ? 'user' : 'assistant',
              content: m.Message,
            })),
            { role: 'user', content: latestCustomerMessage.Message },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (openAiRes.ok) {
        const openAiData = await openAiRes.json();
        const text = openAiData.choices?.[0]?.message?.content;
        if (text && text.trim()) {
          const assistantMessage = await SupportMessage.create({
            ConversationID: conversation.ConversationID,
            SenderUserID: null,
            SenderRole: 'AI',
            SenderName: 'Trợ lý MANB AI',
            Message: text.trim().slice(0, 3000),
          });
          await conversation.update({ LastMessageAt: assistantMessage.CreatedAt });
          return res.status(201).json({ message: assistantMessage });
        }
      }
    } catch (openAiErr) {
      console.warn('OpenAI API call failed, falling back:', openAiErr.message);
    }
  }

  // 3. Sử dụng Engine Tư vấn Thông minh Chuyên sâu Nội bộ (Smart Vietnamese Advice Engine)
  const adviceText = buildSmartAdvice(recentCustomerContext || latestCustomerMessage.Message, products, chronologicalHistory);

  const assistantMessage = await SupportMessage.create({
    ConversationID: conversation.ConversationID,
    SenderUserID: null,
    SenderRole: 'AI',
    SenderName: 'Trợ lý MANB AI',
    Message: adviceText,
  });

  await conversation.update({ LastMessageAt: assistantMessage.CreatedAt });
  return res.status(201).json({ message: assistantMessage, smartEngine: true });
};
