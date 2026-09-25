IF OBJECT_ID(N'dbo.UserAddresses', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserAddresses (
        AddressID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserAddresses PRIMARY KEY,
        UserID INT NOT NULL,
        RecipientName NVARCHAR(150) NOT NULL,
        RecipientPhone NVARCHAR(30) NOT NULL,
        AddressLine NVARCHAR(400) NOT NULL,
        ProvinceCode NVARCHAR(20) NULL,
        ProvinceName NVARCHAR(100) NULL,
        WardCode NVARCHAR(20) NULL,
        WardName NVARCHAR(100) NULL,
        Latitude DECIMAL(10,7) NULL,
        Longitude DECIMAL(10,7) NULL,
        IsDefault BIT NOT NULL CONSTRAINT DF_UserAddresses_IsDefault DEFAULT (0),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserAddresses_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NULL,
        CONSTRAINT FK_UserAddresses_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_UserAddresses_UserID_IsDefault'
      AND object_id = OBJECT_ID(N'dbo.UserAddresses')
)
BEGIN
    CREATE INDEX IX_UserAddresses_UserID_IsDefault
        ON dbo.UserAddresses(UserID, IsDefault, AddressID);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_UserAddresses_OneDefaultPerUser'
      AND object_id = OBJECT_ID(N'dbo.UserAddresses')
)
BEGIN
    CREATE UNIQUE INDEX UX_UserAddresses_OneDefaultPerUser
        ON dbo.UserAddresses(UserID)
        WHERE IsDefault = 1;
END;
GO
