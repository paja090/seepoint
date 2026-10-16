from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import numpy as np
P=Path('output/product-film'); P.mkdir(parents=True,exist_ok=True)
W,H=1920,1080
font=lambda s,b=False: ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf' if b else 'C:/Windows/Fonts/segoeui.ttf',s)
y,x=np.mgrid[0:H,0:W];g=np.exp(-(((x-450)/850)**2+((y-200)/650)**2));h=np.exp(-(((x-1550)/600)**2+((y-800)/650)**2))
a=np.zeros((H,W,3));a[:]=[2,6,23];a+=g[:,:,None]*np.array([34,12,64]);a+=h[:,:,None]*np.array([8,26,50]);bg=Image.fromarray(a.astype('uint8')).convert('RGBA')
def text(im,xy,t,s,c='white',b=False): ImageDraw.Draw(im).text(xy,t,font=font(s,b),fill=c)
def brand(im,x,y,scale=1):
 d=ImageDraw.Draw(im);q=int(66*scale);d.rounded_rectangle((x,y,x+q,y+q),radius=int(20*scale),fill='#7c3aed');d.rounded_rectangle((x+3,y+3,x+q-3,y+q-3),radius=int(18*scale),fill='#101127');text(im,(x+12*scale,y+12*scale),'SP',int(27*scale),b=True);text(im,(x+85*scale,y+3*scale),'SeePoint',int(42*scale),b=True);bx=x+278*scale;d.rounded_rectangle((bx,y+12*scale,bx+65*scale,y+55*scale),radius=12,fill='#33145b',outline='#7537a7');text(im,(bx+10*scale,y+13*scale),'OS',int(25*scale),'#d8b4fe',True)
intro=bg.copy();brand(intro,190,160,1.6);text(intro,(194,350),'Více prostoru pro obchod.',76,b=True);text(intro,(194,450),'Méně rutiny.',96,'#c4b5fd',True);text(intro,(198,610),'AI nástroje pro každodenní práci s reklamními plochami.',34,'#cbd5e1');text(intro,(198,865),'NABÍDKY   /   ÚKOLY   /   OBSAZENOST',22,'#a5b4fc',True);intro.save(P/'intro.png')
out=bg.copy();brand(out,190,160,1.6);text(out,(194,350),'Vaše plochy. Váš tým.',80,b=True);text(out,(194,455),'Jeden SeePoint OS.',88,'#c4b5fd',True);d=ImageDraw.Draw(out);d.rounded_rectangle((198,640,750,742),radius=24,fill='#7c3aed');text(out,(242,658),'Domluvte si ukázku  →',36,b=True);text(out,(198,815),'Operační systém pro outdoor',30,'#cbd5e1');out.save(P/'outro.png')
for mode,num,title,sub in [('offer','01','Od zadání k návrhu nabídky','AI Copilot vybere plochy. Vy doladíte výsledek.'),('task','02','Ze zadání rovnou na úkoly','AI vytvoří přehledný checklist pro váš tým.'),('occupancy','03','Volné plochy? Stačí se zeptat.','Přirozený dotaz nad obsazeností vašich ploch.')]:
 im=bg.copy();text(im,(192,30),num,36,'#a78bfa',True);text(im,(270,25),title,42,b=True);text(im,(270,86),sub,27,'#cbd5e1');brand(im,1455,42,.75);d=ImageDraw.Draw(im);d.rounded_rectangle((187,169,1733,1043),radius=10,outline='#7763a2',width=2);text(im,(192,1049),'UKÁZKOVÁ DATA  •  ZÁZNAM APLIKACE  •  ZRYCHLENÝ PRŮCHOD',16,'#94a3b8');im.save(P/(mode+'-frame.png'))
intro.convert('RGB').save(P/'poster.jpg',quality=93)

