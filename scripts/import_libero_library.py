"""Add only LIBERO catalog resources; retain existing entries and rollback metadata."""
from datetime import datetime, timezone
import hashlib
import gzip
import json
from pathlib import Path
import shlex
import sys
import tarfile

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scripts.model_library_transfer import connect,remote,RECEIVER

ROOT=Path(__file__).resolve().parents[1]
CATALOG=Path('E:/Desktop/123/code_1015/shared/assets/catalog')
LIBRARY='/opt/telebot-model-library'
LIVE='/opt/cloud-service-console-web'

ACTIVATE=r'''
import hashlib,json,os,pathlib,shutil,sqlite3,subprocess,sys,time
stage=pathlib.Path(sys.argv[1]);root=pathlib.Path('/opt/telebot-model-library')
live=pathlib.Path('/opt/cloud-service-console-web');index=root/'catalog/index.json'
new=json.loads((stage/'entries.json').read_text())
assert new and all(r['id'].startswith('libero_') for r in new)
backup=stage/'backup';backup.mkdir()
shutil.copy2(index,backup/'index.json')
shutil.copy2(live/'backend/model_library.py',backup/'model_library.py')
with sqlite3.connect(root/'library.sqlite') as src,sqlite3.connect(backup/'library.sqlite') as dst:src.backup(dst)
before=json.loads(index.read_text());rows={r['id']:r for r in before}
old_ids=set(rows);added=[]
for item in new:
    if item['id'] in rows:
        assert rows[item['id']]==item,'Refusing to replace a different existing model'
    else:added.append(item['id'])
    rows[item['id']]=item
original=index.read_bytes()
sys.path.insert(0,str(stage))
from model_library import ModelLibrary
try:
    candidate=index.with_suffix('.libero.tmp');candidate.write_text(json.dumps(list(rows.values()),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    assert index.read_bytes()==original,'Index changed during staging'
    os.replace(candidate,index)
    data=index.read_bytes()
    with sqlite3.connect(root/'_transfer/files.sqlite') as db:
        db.execute('INSERT OR REPLACE INTO files VALUES (?,?,?)',('index.json',len(data),hashlib.sha256(data).hexdigest()))
    library=ModelLibrary(root,category_overrides=live/'backend/model_category_overrides.json')
    result=library.build()
    with library.connect() as db,sqlite3.connect(backup/'library.sqlite') as old:
        for previous in old.execute('SELECT id,label,source,category,kind,available,directory,bytes,search,entry FROM models'):
            current=db.execute('SELECT id,label,source,category,kind,available,directory,bytes,search,entry FROM models WHERE id=?',(previous[0],)).fetchone()
            assert tuple(current[:9])==previous[:9],previous[0]
            assert json.loads(current[9])==json.loads(previous[9]),previous[0]
    views=[]
    for item in new:
        view=library.view(item['id']);assert view['parts']
        expected=item['parameters']['articulation']['movable_joint_count']
        assert len(view['joints'])==expected
        assert not any(j.get('disabled_reason') for j in view['joints'])
        views.append({'id':item['id'],'parts':len(view['parts']),'joints':len(view['joints'])})
    target=live/'backend/model_library.py';temporary=target.with_suffix('.libero.tmp')
    shutil.copy2(stage/'model_library.py',temporary);os.replace(temporary,target)
    subprocess.run(['sudo','systemctl','restart','cloud-service-console-web.service'],check=True)
    for attempt in range(20):
        check=subprocess.run(['curl','--fail','--silent','http://127.0.0.1:18080/api/access'],capture_output=True)
        if check.returncode==0:break
        time.sleep(1)
    else:raise RuntimeError('Console health check failed')
    receipt={'added':added,'preserved':len(old_ids),'total':len(rows),'views':views,'backup':str(backup),'build':result}
    (stage/'receipt.json').write_text(json.dumps(receipt,indent=2))
    print(json.dumps(receipt),flush=True)
except Exception:
    shutil.copy2(backup/'index.json',index)
    shutil.copy2(backup/'library.sqlite',root/'library.sqlite')
    shutil.copy2(backup/'model_library.py',live/'backend/model_library.py')
    with sqlite3.connect(root/'_transfer/files.sqlite') as db:
        db.execute('INSERT OR REPLACE INTO files VALUES (?,?,?)',('index.json',len(original),hashlib.sha256(original).hexdigest()))
    subprocess.run(['sudo','systemctl','restart','cloud-service-console-web.service'],check=False)
    raise
'''


def main():
    rows=[r for r in json.loads((CATALOG/'index.json').read_text(encoding='utf-8')) if r['id'].startswith('libero_')]
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    stage=LIBRARY+'/_imports/libero-'+stamp
    files=[]
    for row in rows:
        directory=(CATALOG/row['local_descriptor']).parent
        for path in sorted(directory.rglob('*')):
            if path.is_file():
                files.append({'path':path.relative_to(CATALOG).as_posix(),'size':path.stat().st_size,
                              'sha':hashlib.sha256(path.read_bytes()).hexdigest()})
    client=connect()
    try:
        remote(client,'mkdir -p '+shlex.quote(stage))
        with client.open_sftp() as sftp:
            with sftp.open(LIVE+'/backend/model_library.py','rb') as f:backend=f.read().decode()
            replacements=[("    source = row.get('source', '').lower()\n",
                           "    source = row.get('source', '').lower()\n    if 'libero' in source:\n        return 'libero'\n"),
                ("                    parts.append(appearance(part))\n            parents =",
                 "                    texture = visual.find('material/texture')\n                    if texture is not None:\n                        part['texture'] = resource(descriptor.parent.relative_to(self.catalog), texture.get('filename',''))\n                    parts.append(appearance(part))\n            parents =")]
            for old,new in replacements:
                if new not in backend:
                    assert backend.count(old)==1,'Deployed backend differs at patch anchor'
                    backend=backend.replace(old,new)
            for name,content in [('model_library.py',backend),('entries.json',json.dumps(rows)),('activate.py',ACTIVATE),('receiver.py',RECEIVER)]:
                with sftp.open(stage+'/'+name,'w') as f:f.write(content)
            with sftp.open(LIVE+'/frontend/dist/index.html','rb') as f:live_frontend=f.read()
            baseline=(ROOT/'frontend/dist/index.html').read_bytes()
            print(json.dumps({'phase':'inventory','models':len(rows),'files':len(files),'bytes':sum(f['size'] for f in files),
                              'frontend_base_matches':baseline==live_frontend,'stage':stage}),flush=True)
        batches=[];batch=[];size=0
        for item in files:
            if batch and size+item['size']>64*1024**2:
                batches.append(batch);batch=[];size=0
            batch.append(item);size+=item['size']
        if batch:batches.append(batch)
        for number,batch in enumerate(batches):
            signature=hashlib.sha256(json.dumps(batch,sort_keys=True).encode()).hexdigest()
            command='python3 '+shlex.quote(stage+'/receiver.py')+' --root '+LIBRARY+' --batch libero-'+signature[:20]+' --signature '+signature
            stdin,stdout,stderr=client.exec_command(command,timeout=600)
            with gzip.GzipFile(fileobj=stdin,mode='wb',compresslevel=3) as compressed, tarfile.open(fileobj=compressed,mode='w|') as archive:
                for item in batch:
                    path=CATALOG/item['path'];info=archive.gettarinfo(str(path),arcname=item['path'])
                    info.type=tarfile.REGTYPE;info.linkname='';info.size=item['size']
                    info.pax_headers['TELEBOT.sha256']=item['sha']
                    with path.open('rb') as f:archive.addfile(info,f)
            stdin.channel.shutdown_write()
            result=stdout.read().decode();error=stderr.read().decode()
            if stdout.channel.recv_exit_status():raise RuntimeError(error or result)
            print(json.dumps({'phase':'uploaded','batch':number+1,'batches':len(batches),'result':json.loads(result)}),flush=True)
        result=json.loads(remote(client,LIVE+'/.venv/bin/python '+shlex.quote(stage+'/activate.py')+' '+shlex.quote(stage),timeout=300))
        report=ROOT/'reports/libero-catalog-20261106/deployment.json';report.parent.mkdir(parents=True,exist_ok=True)
        report.write_text(json.dumps(result,indent=2),encoding='utf-8')
        print(json.dumps({'phase':'deployed','added':len(result['added']),'total':result['total'],'backup':result['backup']}),flush=True)
    finally:
        client.close()


if __name__=='__main__':
    main()
