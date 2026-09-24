import os, json, numpy as np, soundfile as sf, pyworld as pw
from scipy.signal import butter, sosfilt, resample_poly, fftconvolve
from kokoro_onnx import Kokoro
FILM='/home/user/Claude/film'; M=FILM+'/audio/.models/'
k=Kokoro(M+'kokoro-v1.0.onnx', M+'voices-v1.0.bin')
SR0=24000; SR=48000; TOTAL=2_880_000
VOICE=dict(dot='af_heart', dash='am_fenrir', narrator='bf_emma')
LANG=dict(dot='en-us', dash='en-us', narrator='en-gb')
PAN=dict(dot=-0.22, dash=0.22, narrator=0.0)
# frags: list of (text, pause_after_seconds). speeds: candidate takes. target: preferred duration.
LINES=[
 dict(id='dash_sorry',speaker='dash',text='Oh! Sorry.',start=3.55,budget=0.92,target=0.70,frags=[('Oh! Sorry.',0)],speeds=[1.05,1.12,1.2],level=-20,pitch=0.4),
 dict(id='dot_hi',speaker='dot',text='…Hi.',start=4.55,budget=0.80,target=0.60,frags=[('Hi.',0)],speeds=[0.8,0.85,0.9],level=-25,pitch=-0.3,comp=1.5),
 dict(id='dash_marry',speaker='dash',text='Marry me?',start=12.75,budget=0.66,target=0.62,frags=[('mˈæɹi mˈiː??',0)],phon=True,speeds=[1.1,1.15,1.2],level=-21,rise=True),
 dict(id='dot_yes',speaker='dot',text='YES!',start=13.45,budget=0.50,target=0.45,frags=[('Yes!',0)],speeds=[1.1,1.15,1.2],level=-15.5,pitch=2.0,comp=6),
 dict(id='dot_plan',speaker='dot',text='Wait… we have to plan a wedding.',start=14.90,budget=2.6,target=2.2,frags=[('Wait…',0.38),('we have to plan a wedding.',0)],speeds=[0.9,0.95,1.0],level=-20.5,pitch=-0.3),
 dict(id='dash_gary',speaker='dash',text='Who is Uncle Gary?!',start=19.40,budget=1.5,target=0.95,frags=[('Who is Uncle Gary?!',0)],speeds=[1.1,1.2,1.3],level=-18.5,pitch=1.0,comp=4),
 dict(id='dot_knowgary',speaker='dot',text="I don't KNOW a Gary!",start=21.00,budget=2.1,target=1.05,frags=[("I don't KNOW a Gary!",0)],speeds=[1.0,1.05,1.1],level=-18.5,pitch=0.7,comp=4),
 dict(id='dash_peonies',speaker='dash',text='The florist says the peonies are… emotionally unavailable.',start=23.30,budget=3.2,target=3.0,frags=[('The florist says the peonies are…',0.38),('emotionally unavailable.',0)],speeds=[1.0,1.05,1.1],level=-20),
 dict(id='dot_cant',speaker='dot',text="I can't… do this.",start=26.60,budget=2.4,target=2.0,frags=[("I can't…",0.42),('do this.',0)],speeds=[0.8,0.85,0.9],level=-25.5,pitch=-0.5,reverb=0.16,comp=1.5),
 dict(id='narr_better',speaker='narrator',text='Every love story deserves a better chapter.',start=30.50,budget=3.4,target=2.6,frags=[('Every love story deserves a better chapter.',0)],speeds=[0.86,0.9,0.95],level=-20,reverb=0.10),
 dict(id='dot_oneplace',speaker='dot',text="Wait… it's all in one place?",start=36.50,budget=2.6,target=2.1,frags=[('Wait…',0.30),("it's all in one place?",0)],speeds=[0.92,0.97,1.0],level=-20,pitch=0.5),
 dict(id='dash_table',speaker='dash',text='Gary has a table!',start=40.60,budget=1.3,target=0.95,frags=[('Gary has a table!',0)],speeds=[1.0,1.1,1.2],level=-18.5,pitch=0.8,comp=4),
 dict(id='dot_ido',speaker='dot',text='I do.',start=49.70,budget=0.75,target=0.68,frags=[('I do.',0)],speeds=[0.85,0.9,0.95],level=-22.5,comp=2),
 dict(id='dash_ido',speaker='dash',text='I do.',start=50.50,budget=0.68,target=0.64,frags=[('I do.',0)],speeds=[0.88,0.92,0.96],level=-22.5,comp=2),
 dict(id='narr_logo',speaker='narrator',text='The Wedding Chapter. Write the next one together.',start=55.30,budget=3.0,target=2.85,frags=[('The Wedding Chapter.',0.22),('Write the next one together.',0)],speeds=[0.95,1.0,1.05],level=-20,reverb=0.10),
]
def db(x): return 10**(x/20)
def trim(y, thr_db=-48, pre=0.015, post=0.03):
    w=int(0.004*SR0); env=np.convolve(np.abs(y),np.ones(w)/w,'same'); thr=env.max()*db(thr_db)
    idx=np.where(env>thr)[0]; return y[max(0,idx[0]-int(pre*SR0)): idx[-1]+int(post*SR0)]
def fade(y, sr, fi=0.004, fo=0.025):
    y=y.copy(); a=int(fi*sr); b=int(fo*sr)
    y[:a]*=np.linspace(0,1,a); y[-b:]*=np.linspace(1,0,b)**1.5; return y
def world(y, semis=0.0, rise=False):
    x=y.astype(np.float64); fp=5.0
    f0,t=pw.harvest(x,SR0,f0_floor=60,f0_ceil=600,frame_period=fp); f0=pw.stonemask(x,f0,t,SR0)
    sp=pw.cheaptrick(x,f0,t,SR0); ap=pw.d4c(x,f0,t,SR0)
    f=f0.copy()*2**(semis/12)
    if rise:
        v=np.where(f>0)[0]; pk=v[np.argmax(f[v])]
        # 'me' region: voiced frames after the peak, beyond 55% of voiced span
        start=v[int(len(v)*0.55)]; tail=v[v>=start]; fmax=f[pk]
        n=len(tail); u=np.linspace(0,1,n)
        target=fmax*(0.86+0.34*u**1.4)   # dips slightly then rises to ~1.2x peak
        f[tail]=np.maximum(f[tail],0)*0+target
    out=pw.synthesize(f,sp,ap,SR0,fp)[:len(y)]
    return out.astype(np.float32)
def synth(L, sp):
    parts=[]
    for txt,pause in L['frags']:
        ph = txt if L.get('phon') else k.tokenizer.phonemize(txt, LANG[L['speaker']])
        if L['speaker']=='narrator': ph=ph.replace('wˈɒn','wˈʌn')
        y,_=k.create(ph, voice=VOICE[L['speaker']], speed=sp, is_phonemes=True, trim=False)
        y=trim(y); parts.append(fade(y,SR0,0.003,0.015)); 
        if pause: parts.append(np.zeros(int(pause*SR0),np.float32))
    return np.concatenate(parts)
def compress(y, sr, ratio=2.5, thr_db=-20, att=0.004, rel=0.08):
    if ratio<=1: return y
    a=np.exp(-1/(att*sr)); r=np.exp(-1/(rel*sr)); x=np.abs(y); e=np.zeros_like(x); s=0.0
    for i in range(len(x)):
        c=a if x[i]>s else r; s=c*s+(1-c)*x[i]; e[i]=s
    ref=np.abs(y).max(); edb=20*np.log10(e/ref+1e-9)
    over=np.maximum(edb-thr_db,0); g=db(-over*(1-1/ratio)); return y*g
rng=np.random.default_rng(7)
def room_ir(sr, rt=0.45):
    n=int(rt*sr); t=np.arange(n)/sr; ir=rng.standard_normal(n)*np.exp(-6.9*t/rt)
    sos=butter(2,[250,5000],'bandpass',fs=sr,output='sos'); ir=sosfilt(sos,ir); ir[:int(0.012*sr)]*=np.linspace(0,1,int(0.012*sr)); return ir/np.sqrt(np.sum(ir**2))
IR=room_ir(SR)
HP=butter(2,80,'highpass',fs=SR,output='sos')
def actrms(y):
    H=480; r=np.array([np.sqrt(np.mean(y[i:i+H]**2)) for i in range(0,len(y)-H,H)]); a=r[r>r.max()*0.1]
    return 20*np.log10(np.sqrt(np.mean(a**2)))
def limit(y, ceil, look=0.002, rel=0.06):
    g=np.minimum(1.0, ceil/(np.abs(y)+1e-12)); n=int(look*SR)
    from scipy.ndimage import minimum_filter1d
    g=minimum_filter1d(g, 2*n+1); out=np.empty_like(g); s=1.0; r=np.exp(-1/(rel*SR))
    for i,x in enumerate(g):
        s = x if x<s else r*s+(1-r)*x; out[i]=s
    return y*out
def env30(y, sr, dur):
    n=int(np.ceil(dur*30))+1; w=int(sr/30); vals=[]
    for i in range(n):
        c=int(i/30*sr); seg=y[max(0,c-w//2):c+w//2]; vals.append(np.sqrt(np.mean(seg**2)) if len(seg) else 0)
    v=np.array(vals); out=np.zeros_like(v); s=0
    for i,x in enumerate(v): c=0.75 if x>s else 0.45; s=s+c*(x-s); out[i]=s
    out=out/(out.max()+1e-9); out=np.clip(out,0,1)**0.8; out[out<0.06]=0
    out[0]=min(out[0],out[1]) ; out[-1]=0.0
    return [round(float(x),2) for x in out]
os.makedirs(FILM+'/audio/lines',exist_ok=True); os.makedirs(FILM+'/audio/stems',exist_ok=True); os.makedirs(FILM+'/data',exist_ok=True)
mix=np.zeros((TOTAL,2),np.float32); data=[]; report=[]
for L in LINES:
    takes=[]
    for sp in L['speeds']:
        y=synth(L,sp)
        if L.get('pitch') or L.get('rise'): y=world(y, L.get('pitch',0), L.get('rise',False))
        d=len(y)/SR0; takes.append((abs(d-L['target'])+ (10 if d>L['budget'] else 0), sp, y))
    takes.sort(key=lambda t:t[0]); _,sp,y=takes[0]
    y=resample_poly(y,2,1).astype(np.float64)
    y=sosfilt(HP,y); y=compress(y,SR,ratio=L.get('comp',3)); y=fade(y,SR,0.004,0.03)
    y=y/np.abs(y).max()*db(-3)                  # peak normalise -3 dBFS
    dry_dur=len(y)/SR
    env=env30(y,SR,dry_dur)
    if L.get('reverb'):
        wet=fftconvolve(y,IR)[:len(y)+int(0.5*SR)]; yy=np.zeros(len(wet)); yy[:len(y)]=y
        y=yy+L['reverb']*wet*(np.abs(y).max()/ (np.abs(wet).max()+1e-9)) ; y=fade(y,SR,0.001,0.15); y=y/np.abs(y).max()*db(-3)
    y=y*db(L['level']-actrms(y))                  # level = target active-speech RMS dBFS
    pk=20*np.log10(np.abs(y).max()); y=limit(y, db(-3.2))
    p=PAN[L['speaker']]; th=(p+1)*np.pi/4; st=np.stack([y*np.cos(th),y*np.sin(th)],1)
    st=st*(np.abs(y).max()/np.abs(st).max())         # pan law normalised so loudest channel keeps the mono peak
    sf.write(f"{FILM}/audio/lines/{L['id']}.wav", st.astype(np.float32), SR, subtype='PCM_24')
    i0=int(round(L['start']*SR)); mix[i0:i0+len(st)]+=st[:TOTAL-i0]
    end=round(L['start']+dry_dur,3)
    data.append(dict(id=L['id'],speaker=L['speaker'],text=L['text'],start=L['start'],end=end,env=env))
    report.append((L['id'],L['start'],end,round(dry_dur,3),L['budget'],sp))
    print(L['id'],'speed',sp,'start',L['start'],'end',end,'dur',round(dry_dur,3),'budget',L['budget'],'peak dB',round(20*np.log10(np.abs(st).max()),2),flush=True)
sf.write(FILM+'/audio/stems/dialogue.wav', mix, SR, subtype='PCM_24')
js=json.dumps(data,separators=(',',':'))
open(FILM+'/data/dialogue.json','w').write(json.dumps(data,indent=None,separators=(', ',': ')).replace('}, {','},\n {')+'\n')
open(FILM+'/data/dialogue.js','w').write('window.DIALOGUE = '+js+';\n')
json.dump(report,open('report.json','w'))
