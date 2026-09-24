IF COL_LENGTH('dbo.Orders', 'DiscountAmount') IS NULL
BEGIN
    ALTER TABLE dbo.Orders
    ADD DiscountAmount DECIMAL(18, 2) NULL;
END;
GO

IF COL_LENGTH('dbo.Orders', 'VoucherCode') IS NULL
BEGIN
    ALTER TABLE dbo.Orders
    ADD VoucherCode NVARCHAR(50) NULL;
END;
GO

IF COL_LENGTH('dbo.Orders', 'VoucherID') IS NULL
BEGIN
    ALTER TABLE dbo.Orders
    ADD VoucherID INT NULL;
END;
GO
