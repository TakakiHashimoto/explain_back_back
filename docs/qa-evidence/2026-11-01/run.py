import os,sys,subprocess,json,time,pathlib,re
root=pathlib.Path('/data/Projects/explain-back'); out=root/'docs/qa-evidence/2026-11-01'
label,cwd,*cmd=sys.argv[1:]
env=os.environ.copy();env.update(OPENAI_API_KEY='qa-no-live-openai',ONESIGNAL_APP_ID='qa-no-live-push',ONESIGNAL_REST_API_KEY='qa-no-live-push',NOTIFICATION_DRY_RUN='true',CI='1',EXPO_NO_TELEMETRY='1')
env['DATABASE_URL']='postgresql://qa@127.0.0.1:55439/qa_unused';env['TEST_DATABASE_URL']='postgresql://qa@127.0.0.1:55439/explain_back_qa_20261101'
if label.startswith(('prisma','http','additional','restart')):env['DATABASE_URL']=env['TEST_DATABASE_URL']
secrets=[]
for p in [root/'apps/backend/.env',root/'apps/mobile/.env.local']:
 if p.exists():
  for line in p.read_text().splitlines():
   if '=' in line and not line.lstrip().startswith('#'):
    v=line.split('=',1)[1].strip().strip('\"\'')
    if len(v)>10:secrets.append(v)
start=time.monotonic();p=subprocess.Popen(cmd,cwd=root/cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
with (out/(label+'.log')).open('w') as f:
 for line in p.stdout:
  for v in secrets:line=line.replace(v,'[REDACTED]')
  line=re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+','[REDACTED JWT]',line)
  f.write(line);f.flush()
code=p.wait();record={'label':label,'cwd':str(root/cwd),'command':cmd,'exit_code':code,'seconds':round(time.monotonic()-start,2),'log':label+'.log'}
with (out/'commands.jsonl').open('a') as f:f.write(json.dumps(record)+'\n')
print(json.dumps(record));print((out/(label+'.log')).read_text()[-10000:]);sys.exit(code)
