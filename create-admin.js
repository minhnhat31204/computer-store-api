const { User, sequelize } = require('./src/models');
const { hashPassword, normalizePhone } = require('./src/services/authSecurity');

async function createOrUpdateAdmin() {
  const phone = process.argv[2] || '0987654321';
  const password = process.argv[3] || 'admin123450';
  const fullName = process.argv[4] || 'Quản trị viên (Admin)';
  const email = process.argv[5] || 'admin@manb.id.vn';

  try {
    await sequelize.authenticate();
    console.log('✅ Kết nối CSDL thành công.');

    const normalizedPhone = normalizePhone(phone);
    const passwordHash = await hashPassword(password);

    let user = await User.findOne({
      where: {
        Phone: normalizedPhone
      }
    });

    if (user) {
      user.FullName = fullName;
      user.Email = email;
      user.Role = 'Admin';
      user.PasswordHash = passwordHash;
      await user.save();
      console.log(`\n🎉 ĐÃ CẬP NHẬT TÀI KHOẢN ADMIN THÀNH CÔNG:`);
    } else {
      user = await User.create({
        FullName: fullName,
        Phone: normalizedPhone,
        Email: email,
        Role: 'Admin',
        PasswordHash: passwordHash,
      });
      console.log(`\n🎉 ĐÃ TẠO MỚI TÀI KHOẢN ADMIN THÀNH CÔNG:`);
    }

    console.log(`----------------------------------------`);
    console.log(`- Họ và tên   : ${user.FullName}`);
    console.log(`- Số điện thoại: ${user.Phone}`);
    console.log(`- Email       : ${user.Email}`);
    console.log(`- Quyền (Role): ${user.Role}`);
    console.log(`- Mật khẩu    : ${password}`);
    console.log(`----------------------------------------\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi tạo tài khoản Admin:', error);
    process.exit(1);
  }
}

createOrUpdateAdmin();
