-- 修复 oauth_accounts 表中 server_url 为 NULL 的记录
-- 为 GitHub 和 GitLab 设置默认的 server_url

UPDATE oauth_accounts
SET 
  server_url = CASE 
    WHEN provider = 'github' THEN 'https://github.com'
    WHEN provider = 'gitlab' THEN 'https://gitlab.com'
    ELSE server_url
  END,
  server_type = COALESCE(server_type, 'cloud')
WHERE server_url IS NULL;
