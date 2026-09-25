IF OBJECT_ID(N'dbo.Notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Notifications (
        NotificationID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY,
        UserID INT NOT NULL,
        OrderID INT NULL,
        EventKey NVARCHAR(200) NOT NULL,
        Type NVARCHAR(50) NOT NULL,
        Title NVARCHAR(160) NOT NULL,
        Message NVARCHAR(500) NOT NULL,
        IsRead BIT NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT (0),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_Notifications_Orders FOREIGN KEY (OrderID) REFERENCES dbo.Orders(OrderID) ON DELETE SET NULL
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_Notifications_EventKey'
      AND object_id = OBJECT_ID(N'dbo.Notifications')
)
BEGIN
    CREATE UNIQUE INDEX UX_Notifications_EventKey ON dbo.Notifications(EventKey);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Notifications_UserID_IsRead_CreatedAt'
      AND object_id = OBJECT_ID(N'dbo.Notifications')
)
BEGIN
    CREATE INDEX IX_Notifications_UserID_IsRead_CreatedAt
        ON dbo.Notifications(UserID, IsRead, CreatedAt DESC);
END;
GO
