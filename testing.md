after npm run dev , i went to docs app and used try it functionality

i first hit the token api

1. first got status 304 for /credentials
2. then got status 200 and cors error for /token api. i think this is expected based on  @CORS_SETUP.md

after this i hit the https://api.finarkein.in/factory/v1/tsfsl/dp/nerv/376b71fe-009b-4154-850c-fa0eb65b4d5a after filling the values of workspace and flowid manually

1. im seeing /credentials again (with same behaviour as before)
2. im seeing /token api again (with same behaviour as before)
3. im not seeing https://api.finarkein.in/factory/v1/tsfsl/dp/nerv/376b71fe-009b-4154-850c-fa0eb65b4d5a in network request.


is this expected behavior?