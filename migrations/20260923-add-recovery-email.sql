IF COL_LENGTH(N'dbo.Users', N'RecoveryEmail') IS NULL
    ALTER TABLE [dbo].[Users] ADD [RecoveryEmail] NVARCHAR(255) NULL;
GO

IF COL_LENGTH(N'dbo.Users', N'RecoveryEmailVerified') IS NULL
    ALTER TABLE [dbo].[Users] ADD [RecoveryEmailVerified] BIT NOT NULL
        CONSTRAINT [DF_Users_RecoveryEmailVerified] DEFAULT (0) WITH VALUES;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'UX_Users_RecoveryEmail'
      AND [object_id] = OBJECT_ID(N'dbo.Users')
)
    CREATE UNIQUE INDEX [UX_Users_RecoveryEmail]
        ON [dbo].[Users] ([RecoveryEmail])
        WHERE [RecoveryEmail] IS NOT NULL;
GO
