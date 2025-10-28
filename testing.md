when hitting https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token

seeing 3 requests in sequence

1. first got status 304
curl ^"http://localhost:3001/api/workspace/credentials^" ^
  -H ^"Accept: */*^" ^
  -H ^"Accept-Language: en-US,en;q=0.9^" ^
  -H ^"Connection: keep-alive^" ^
  -H ^"Content-Type: application/json^" ^
  -H ^"If-None-Match: W/^\^"162-pwl/klFyqdIYqBqftFeFDBNJ3hA^\^"^" ^
  -H ^"Origin: http://localhost:3000^" ^
  -H ^"Referer: http://localhost:3000/^" ^
  -H ^"Sec-Fetch-Dest: empty^" ^
  -H ^"Sec-Fetch-Mode: cors^" ^
  -H ^"Sec-Fetch-Site: same-site^" ^
  -H ^"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36^" ^
  -H ^"sec-ch-ua: ^\^"Google Chrome^\^";v=^\^"141^\^", ^\^"Not?A_Brand^\^";v=^\^"8^\^", ^\^"Chromium^\^";v=^\^"141^\^"^" ^
  -H ^"sec-ch-ua-mobile: ?0^" ^
  -H ^"sec-ch-ua-platform: ^\^"Windows^\^"^"

2.  got status 304 again

curl ^"http://localhost:3001/api/workspace/credentials?workspace=tsfsl^" ^
  -H ^"Accept: */*^" ^
  -H ^"Accept-Language: en-US,en;q=0.9^" ^
  -H ^"Connection: keep-alive^" ^
  -H ^"Content-Type: application/json^" ^
  -H ^"If-None-Match: W/^\^"162-pwl/klFyqdIYqBqftFeFDBNJ3hA^\^"^" ^
  -H ^"Origin: http://localhost:3000^" ^
  -H ^"Referer: http://localhost:3000/^" ^
  -H ^"Sec-Fetch-Dest: empty^" ^
  -H ^"Sec-Fetch-Mode: cors^" ^
  -H ^"Sec-Fetch-Site: same-site^" ^
  -H ^"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36^" ^
  -H ^"sec-ch-ua: ^\^"Google Chrome^\^";v=^\^"141^\^", ^\^"Not?A_Brand^\^";v=^\^"8^\^", ^\^"Chromium^\^";v=^\^"141^\^"^" ^
  -H ^"sec-ch-ua-mobile: ?0^" ^
  -H ^"sec-ch-ua-platform: ^\^"Windows^\^"^"

3. then got status 200 and cors error
curl ^"https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token^" ^
  -H ^"accept: */*^" ^
  -H ^"accept-language: en-US,en;q=0.9^" ^
  -H ^"authorization: Basic Y2xpZW50LXRzZnNsLTAzZDk1MmQ2OkoyRE9OT0JKOVB3Y0w1QUd6cW9iVENZMnZhdjllMXhw^" ^
  -H ^"content-type: application/x-www-form-urlencoded^" ^
  -H ^"origin: http://localhost:3000^" ^
  -H ^"priority: u=1, i^" ^
  -H ^"referer: http://localhost:3000/^" ^
  -H ^"sec-ch-ua: ^\^"Google Chrome^\^";v=^\^"141^\^", ^\^"Not?A_Brand^\^";v=^\^"8^\^", ^\^"Chromium^\^";v=^\^"141^\^"^" ^
  -H ^"sec-ch-ua-mobile: ?0^" ^
  -H ^"sec-ch-ua-platform: ^\^"Windows^\^"^" ^
  -H ^"sec-fetch-dest: empty^" ^
  -H ^"sec-fetch-mode: cors^" ^
  -H ^"sec-fetch-site: cross-site^" ^
  -H ^"user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36^" ^
  --data-raw ^"grant_type=client_credentials^"