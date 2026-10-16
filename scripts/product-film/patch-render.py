from pathlib import Path
p=Path('scripts/product-film/render.py');s=p.read_text(encoding='utf-8-sig')
s=s.replace("if 'error' in marks:raise RuntimeError(name+' recording failed')","if 'error' in marks and not(name=='offer' and 'result' in marks):raise RuntimeError(name+' recording failed')\n  if name=='offer' and 'created' not in marks:marks['end']=marks['confirm']")
s=s.replace("if name=='offer':spans +=", "if name=='offer' and 'created' in marks:spans +=")
s=s.replace("run(['-i',str(P/(name+'.webm')),'-loop'", "frames=json.loads((P/(name+'-frames.json')).read_text())\n  lines=[]\n  for i,fr in enumerate(frames):\n   stop=frames[i+1]['t'] if i+1<len(frames) else max(marks['end'],fr['t']+.1)\n   duration=stop-(fr['t'] if i else 0)\n   lines.extend([\"file 'frames-\"+name+\"/\"+fr['file']+\"'\",'option framerate 1000','duration '+str(max(.001,duration))])\n  lines.append(\"file 'frames-\"+name+\"/\"+frames[-1]['file']+\"'\")\n  (P/(name+'-frames.txt')).write_text('\\n'.join(lines))\n  run(['-f','concat','-safe','0','-i',str(P/(name+'-frames.txt')),'-loop'")
p.write_text(s,encoding='utf-8')
