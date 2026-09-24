import numpy as np, soundfile as sf, scipy.signal as ss
x, sr = sf.read('audio/stereo22k.wav'); M = x.mean(1); S = (x[:,0]-x[:,1])/2
hop=512; n=2048
def stft(y):
    f,t,Z = ss.stft(y, sr, nperseg=n, noverlap=n-hop, boundary=None); return f,t,np.abs(Z)
f,t,Zm = stft(M); _,_,Zs = stft(S)
# onset envelope
lm = np.log1p(100*Zm); flux = np.maximum(0, np.diff(lm,axis=1)).sum(0); flux = np.r_[0,flux]
fr = sr/hop
env = flux - ss.medfilt(flux, 31); env=np.maximum(env,0)
# tempo via autocorr
ac = np.correlate(env-env.mean(), env-env.mean(), 'full')[len(env)-1:]
lags = np.arange(len(ac))/fr; bpms = 60/lags[1:]
sel = (bpms>60)&(bpms<180)
cand = np.argsort(ac[1:][sel])[::-1][:8]
print('tempo cands', [(round(bpms[sel][c],2), round(ac[1:][sel][c]/ac[0],3)) for c in cand])
rms = np.sqrt((Zm**2).mean(0))
sec = int(len(M)/sr)
band = (f>250)&(f<4000)
vm = (Zm[band]**2).sum(0); vs = (Zs[band]**2).sum(0)
for s in range(0,sec,2):
    i=(t>=s)&(t<s+2)
    print(f"{s:4d}s rms {20*np.log10(rms[i].mean()+1e-9):6.1f}  midband {10*np.log10(vm[i].mean()+1e-9):6.1f} side {10*np.log10(vs[i].mean()+1e-9):6.1f}  cent {(f[:,None]*Zm[:,i]).sum()/Zm[:,i].sum():6.0f}")
np.savez('audio/feat.npz', t=t, env=env, rms=rms, f=f)
