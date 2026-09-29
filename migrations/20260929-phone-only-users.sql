-- Allow phone-only accounts to have no email. Keep real email addresses unique,
-- while permitting any number of NULL Email values in SQL Server.
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE [name] = N'UX_Users_Email_NotNull'
          AND [object_id] = OBJECT_ID(N'dbo.Users')
    )
        DROP INDEX [UX_Users_Email_NotNull] ON [dbo].[Users];

    DECLARE @dropSql NVARCHAR(MAX) = N'';

    SELECT @dropSql = @dropSql +
        CASE WHEN kc.[name] IS NOT NULL
            THEN N'ALTER TABLE [dbo].[Users] DROP CONSTRAINT ' + QUOTENAME(kc.[name]) + N';'
            ELSE N'DROP INDEX ' + QUOTENAME(i.[name]) + N' ON [dbo].[Users];'
        END
    FROM sys.indexes AS i
    INNER JOIN sys.index_columns AS ic
        ON ic.[object_id] = i.[object_id] AND ic.[index_id] = i.[index_id] AND ic.[key_ordinal] = 1
    INNER JOIN sys.columns AS c
        ON c.[object_id] = ic.[object_id] AND c.[column_id] = ic.[column_id]
    LEFT JOIN sys.key_constraints AS kc
        ON kc.[parent_object_id] = i.[object_id] AND kc.[unique_index_id] = i.[index_id]
    WHERE i.[object_id] = OBJECT_ID(N'dbo.Users')
      AND i.[is_unique] = 1
      AND i.[is_primary_key] = 0
      AND i.[filter_definition] IS NULL
      AND c.[name] = N'Email';

    IF LEN(@dropSql) > 0 EXEC sys.sp_executesql @dropSql;

    ALTER TABLE [dbo].[Users] ALTER COLUMN [Email] NVARCHAR(255) NULL;

    UPDATE [dbo].[Users]
       SET [Email] = NULL
     WHERE [Email] LIKE N'phone-%@phone.manb.local'
        OR [Email] LIKE N'phone-%@phone.local';

    UPDATE [dbo].[Users]
       SET [Phone] = N'0' + SUBSTRING([Phone], 4, 9)
     WHERE [Phone] LIKE N'+84%'
       AND LEN([Phone]) = 12
       AND SUBSTRING([Phone], 4, 9) NOT LIKE N'%[^0-9]%';

    UPDATE [dbo].[Users]
       SET [Phone] = N'0' + SUBSTRING([Phone], 3, 9)
     WHERE [Phone] LIKE N'84%'
       AND LEN([Phone]) = 11
       AND SUBSTRING([Phone], 3, 9) NOT LIKE N'%[^0-9]%';

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE [name] = N'UX_Users_Email_NotNull'
          AND [object_id] = OBJECT_ID(N'dbo.Users')
    )
        CREATE UNIQUE INDEX [UX_Users_Email_NotNull]
            ON [dbo].[Users] ([Email])
            WHERE [Email] IS NOT NULL;
END;
GO
