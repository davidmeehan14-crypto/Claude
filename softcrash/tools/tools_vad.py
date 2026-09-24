import numpy as np, soundfile as sf, scipy.signal as ss
x, sr = sf.read('audio/stereo22k.wav')
n=2048; hop=256
f,t,L = ss.stft(x[:,0], sr, nperseg=n, noverlap=n-hop, boundary=None)
_,_,R = ss.stft(x[:,1], sr, nperseg=n, noverlap=n-hop, boundary=None)
Mx=(L+R)/2; Sd=(L-R)/2
# center mask: similarity of L and R
sim = 2*np.abs(L*np.conj(R))/(np.abs(L)**2+np.abs(R)**2+1e-12)
cmask = np.clip((sim-0.8)/0.2,0,1)**2
C = np.abs(Mx)*cmask
band=(f>300)&(f<3500)
# harmonic via temporal median (HPSS-ish)
Hc = ss.medfilt2d(C[band].astype(np.float32),(1,17)); Pc = ss.medfilt2d(C[band].astype(np.float32),(17,1))
harm = (Hc**2/(Hc**2+Pc**2+1e-12))*C[band]
voc = harm.sum(0)
# reference: side-band harmonic energy (instruments)
sideE = (np.abs(Sd[band])).sum(0)
fr=sr/hop
voc_s = ss.savgol_filter(voc, 9, 2); 
np.savez('audio/vad.npz', t=t, voc=voc, side=sideE)
dt=0.25; step=int(dt*fr)
v = np.array([voc[i:i+step].mean() for i in range(0,len(voc)-step,step)])
s = np.array([sideE[i:i+step].mean() for i in range(0,len(voc)-step,step)])
vdb=20*np.log10(v+1e-9); ref=np.percentile(vdb,95)
chars=" .:-=+*#%@"
line=""
for k,d in enumerate(vdb):
    if k%40==0: 
        if line: print(line)
        line=f"{k*dt:6.1f} "
    lv=int(np.clip((d-(ref-24))/24*9,0,9)); line+=chars[lv]
print(line)
