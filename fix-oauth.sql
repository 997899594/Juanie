UPDATE oauth_accounts SET server_url = 'https://github.com', server_type = 'cloud' WHERE server_url IS NULL AND provider = 'github';
UPDATE oauth_accounts SET server_url = 'https://gitlab.com', server_type = 'cloud' WHERE server_url IS NULL AND provider = 'gitlab';
SELECT COUNT(*) as fixed_records FROM oauth_accounts WHERE server_url IS NOT NULL;
