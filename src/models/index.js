const sequelize = require('../config/database');
const Voucher = require('./Voucher');
const Promotion = require('./Promotion');
const User = require('./User');
const Category = require('./Category');
const Product = require('./Product');
const ProductVariant = require('./ProductVariant');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const CartItemDB = require('./CartItemDB');
const Review = require('./Review');
// const BuildPC = require('./BuildPC');
// const BuildPCItem = require('./BuildPCItem');
const Favorite = require('./Favorite');
const PaymentTransaction = require('./PaymentTransaction');

// 1. Category 1 - N Product
Category.hasMany(Product, { foreignKey: 'CategoryID' });
Product.belongsTo(Category, { foreignKey: 'CategoryID' });

// 2. Product 1 - N ProductVariant
Product.hasMany(ProductVariant, { foreignKey: 'ProductID' });
ProductVariant.belongsTo(Product, { foreignKey: 'ProductID' });

// 3. User 1 - N Order
User.hasMany(Order, { foreignKey: 'UserID' });
Order.belongsTo(User, { foreignKey: 'UserID' });
Order.hasMany(PaymentTransaction, { foreignKey: 'OrderID', as: 'Payments' });
PaymentTransaction.belongsTo(Order, { foreignKey: 'OrderID', as: 'Order' });

// 4. Order 1 - N OrderItem
Order.hasMany(OrderItem, { foreignKey: 'OrderID' });
OrderItem.belongsTo(Order, { foreignKey: 'OrderID' });

// 5. Product 1 - N OrderItem
Product.hasMany(OrderItem, { foreignKey: 'ProductID' });
OrderItem.belongsTo(Product, { foreignKey: 'ProductID' });

// 6. User 1 - N CartItemDB
User.hasMany(CartItemDB, { foreignKey: 'UserID' });
CartItemDB.belongsTo(User, { foreignKey: 'UserID' });

// 7. Product 1 - N CartItemDB
Product.hasMany(CartItemDB, { foreignKey: 'ProductID' });
CartItemDB.belongsTo(Product, { foreignKey: 'ProductID' });

// 8. User 1 - N Review
User.hasMany(Review, { foreignKey: 'UserID' });
Review.belongsTo(User, { foreignKey: 'UserID' });

// 9. Product 1 - N Review
Product.hasMany(Review, { foreignKey: 'ProductID' });
Review.belongsTo(Product, { foreignKey: 'ProductID' });

// 10. User 1 - N BuildPC
// User.hasMany(BuildPC, { foreignKey: 'UserID' });
// BuildPC.belongsTo(User, { foreignKey: 'UserID' });

// 11. BuildPC 1 - N BuildPCItem (Cáº¥u trÃºc tá»‘i Æ°u má»›i)
// BuildPC.hasMany(BuildPCItem, { foreignKey: 'BuildPCID' });
// BuildPCItem.belongsTo(BuildPC, { foreignKey: 'BuildPCID' });

// 12. Product 1 - N BuildPCItem
// Product.hasMany(BuildPCItem, { foreignKey: 'ProductID' });
// BuildPCItem.belongsTo(Product, { foreignKey: 'ProductID' });

// User.belongsToMany(Product, { through: Favorite, foreignKey: 'UserID' });
// Product.belongsToMany(User, { through: Favorite, foreignKey: 'ProductID' });

// Thiáº¿t láº­p quan há»‡ giá»¯a Favorite vÃ  Product
Favorite.belongsTo(Product, { 
  foreignKey: 'ProductID', // TÃªn khÃ³a ngoáº¡i trong báº£ng Favorites
  as: 'Product'            // TÃªn alias tráº£ vá» khi include
});

Product.hasMany(Favorite, { 
  foreignKey: 'ProductID' 
});

Review.belongsTo(User, { foreignKey: 'UserID' });
Review.belongsTo(Product, { foreignKey: 'ProductID' });

module.exports = {
  sequelize,
  Voucher,
  Promotion,
  User,
  Category,
  Product,
  ProductVariant,
  Order,
  OrderItem,
  CartItemDB,
  Review,
  // BuildPC,
  // BuildPCItem,
  Favorite,
  PaymentTransaction,
};

