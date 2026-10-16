import json,subprocess,math,wave
from pathlib import Path
import numpy as np
P=Path('output/product-film'); F='tmp/video-deps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def run(args):
 r=subprocess.run([F,'-hide_banner','-loglevel','error','-y',*args],capture_output=True,text=True)
 if r.returncode: raise RuntimeError(r.stderr)
def enc():return ['-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-threads','2','-an']
parts=[]; durations=[]
for name in ['intro','offer','task','occupancy','outro']:
 target=P/(name+'-edit.mp4')
 if name in ['intro','outro']:
  d=4.5 if name=='intro' else 5
  run(['-loop','1','-framerate','30','-i',str(P/(name+'.png')),'-t',str(d),'-vf',f"scale=1960:1102,crop=1920:1080:x='20+10*sin(t)':y='11+8*cos(t)',fade=t=in:d=0.5,fade=t=out:st={d-.3}:d=0.3",*enc(),str(target)])
 else:
  marks={m['name']:m['t'] for m in json.loads((P/(name+'-marks.json')).read_text())}
  if 'error' in marks and not(name=='offer' and 'result' in marks):raise RuntimeError(name+' recording failed')
  if name=='offer' and 'created' not in marks:marks['end']=marks['confirm']
  spans=[(max(marks['ready'],marks['typing']-1.5),marks['submit']+.7,max(1,(marks['submit']+.7-max(marks['ready'],marks['typing']-1.5))/12)),(max(marks['submit']+.7,marks['result']-.5),marks.get('confirm',marks['end']),max(1,(marks.get('confirm',marks['end'])-max(marks['submit']+.7,marks['result']-.5))/6))]
  if name=='offer' and 'created' in marks:spans += [(marks['confirm'],marks['confirm']+1,1),(marks['created'],marks['end'],1)]
  spans=[s for s in spans if s[1]>s[0]];d=sum((z-a)/speed for a,z,speed in spans)
  filters=[f'[0:v]split={len(spans)}'+''.join(f'[s{i}]'for i in range(len(spans)))]
  for i,(a,z,speed) in enumerate(spans):filters.append(f'[s{i}]trim=start={a}:end={z},setpts=(PTS-STARTPTS)/{speed},fps=30[v{i}]')
  filters.append(''.join(f'[v{i}]'for i in range(len(spans)))+f'concat=n={len(spans)}:v=1:a=0,scale=1536:864[film]')
  filters.append(f"[1:v][film]overlay=x=192:y='174+25*exp(-7*t)':shortest=1,fade=t=in:d=0.25,fade=t=out:st={d-.25}:d=0.25[out]")
  frames=json.loads((P/(name+'-frames.json')).read_text())
  lines=[]
  for i,fr in enumerate(frames):
   stop=frames[i+1]['t'] if i+1<len(frames) else max(marks['end'],fr['t']+.1)
   duration=stop-(fr['t'] if i else 0)
   lines.extend(["file 'frames-"+name+"/"+fr['file']+"'",'option framerate 1000','duration '+str(max(.001,duration))])
  lines.append("file 'frames-"+name+"/"+frames[-1]['file']+"'")
  (P/(name+'-frames.txt')).write_text('\n'.join(lines))
  run(['-f','concat','-safe','0','-i',str(P/(name+'-frames.txt')),'-loop','1','-framerate','30','-i',str(P/(name+'-frame.png')),'-filter_complex',';'.join(filters),'-map','[out]','-t',str(d),*enc(),str(target)])
 parts.append(target);durations.append(d);print(name,round(d,2),flush=True)
(P/'concat.txt').write_text(''.join("file '"+p.name+"'\n" for p in parts))
T=sum(durations);rate=44100;t=np.arange(int((T+1)*rate))/rate;audio=np.zeros_like(t)
# Original understated synthesized score, no external music assets.
for beat in np.arange(0,T,.625):
 k=int(beat/.625);f=[164.81,207.65,246.94,329.63,146.83,185,220,293.66][k%8];dt=t-beat;env=np.where((dt>=0)&(dt<2),np.exp(-np.maximum(dt,0)*3)*(1-np.exp(-np.maximum(dt,0)*80)),0);audio+=.035*env*(np.sin(2*np.pi*f*dt)+.25*np.sin(2*np.pi*f*2*dt))
for f in [82.405,123.47,164.81]:audio+=.008*np.sin(2*np.pi*f*t)*(0.65+.35*np.sin(2*np.pi*.12*t))
audio*=np.minimum(t/2,1)*np.minimum(np.maximum(T-t,0)/3,1);stereo=np.stack([audio,audio*.96],axis=1);pcm=(np.clip(stereo,-.9,.9)*32767).astype('<i2')
with wave.open(str(P/'score.wav'),'wb')as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
run(['-f','concat','-safe','0','-i',str(P/'concat.txt'),'-i',str(P/'score.wav'),'-c:v','copy','-c:a','aac','-b:a','160k','-t',str(T),'-movflags','+faststart',str(P/'seepoint-os-live.mp4')])
(P/'edit-summary.json').write_text(json.dumps({'duration':T,'chapters':dict(zip([p.stem for p in parts],durations))},indent=2));print('DONE',T,flush=True)

