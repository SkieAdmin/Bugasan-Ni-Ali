from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import xml.etree.ElementTree as ET
import html

OUT = Path(__file__).parent
W, H = 2400, 1350
im = Image.new('RGB', (W, H), '#FFFFFF')
d = ImageDraw.Draw(im)
green, gold, ink, muted = '#1E6B47', '#D99A1E', '#1D2621', '#4F5852'

def font(size, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/arial'+('bd' if bold else '')+'.ttf', size)

def txt(x,y,t,size=30,fill=ink,bold=False):
    d.text((x,y),t,font=font(size,bold),fill=fill)

def center(x,y,w,t,size=30,fill=ink,bold=False):
    f=font(size,bold)
    d.text((x+(w-d.textlength(t,font=f))/2,y),t,font=f,fill=fill)

model=ET.Element('mxfile',host='app.diagrams.net')
diagram=ET.SubElement(model,'diagram',name='Conceptual Framework',id='bugasan-ipo')
graph=ET.SubElement(diagram,'mxGraphModel',dx=str(W),dy=str(H),grid='1',gridSize='10',page='1',pageScale='1',pageWidth=str(W),pageHeight=str(H))
root=ET.SubElement(graph,'root'); ET.SubElement(root,'mxCell',id='0'); ET.SubElement(root,'mxCell',id='1',parent='0')

def node(id,x,y,w,h,value,style):
    c=ET.SubElement(root,'mxCell',id=id,parent='1',vertex='1',value=value,style=style)
    ET.SubElement(c,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),attrib={'as':'geometry'})

def label(id,x,y,w,h,value,size=30,color=ink,bold=False):
    node(id,x,y,w,h,value,f'text;html=1;align=left;verticalAlign=top;whiteSpace=wrap;strokeColor=none;fillColor=none;fontFamily=Arial;fontSize={size};fontColor={color};fontStyle={1 if bold else 0};')

d.rectangle((95,75,195,85),fill=gold)
txt(95,112,'BUGASAN NI ALI',30,green,True)
txt(95,165,'Conceptual Framework',64,ink,True)
txt(95,250,'Input–Process–Output (IPO) model for rice ordering and inventory management',30,muted)
label('title',95,160,2200,80,'Conceptual Framework — Bugasan ni Ali',60,ink,True)
label('subtitle',95,250,2200,45,'Input–Process–Output (IPO) model for rice ordering and inventory management',30,muted)

panels=[
('input',95,'INPUT',[
('Customer information','Account, contact, and delivery details'),
('Product information','Rice varieties, prices, and stock'),
('Order details','Quantities, fulfillment, and schedule'),
('Supplier information','Contacts and purchase order details'),
('Store settings','Discount rules and delivery fees')]),
('process',895,'PROCESS',[
('Validate information','Check user access and available stock'),
('Calculate order totals','Apply prices, discounts, and fees'),
('Record transactions','Save orders, items, and payments'),
('Manage fulfillment','Update delivery or pickup status'),
('Update inventory','Record sales, returns, and restocks')]),
('output',1695,'OUTPUT',[
('Orders and receipts','Recorded sales and itemized totals'),
('Updated inventory','Available stock per rice variety'),
('Order status updates','Progress of delivery or pickup'),
('Low-stock alerts','Products needing replenishment'),
('Management reports','Sales, inventory, and supplier purchases')])]

for id,x,title,rows in panels:
    d.rounded_rectangle((x,345,x+610,990),radius=16,fill='#FFFFFF',outline='#B7CCBE',width=3)
    d.rounded_rectangle((x,345,x+610,435),radius=16,fill=green)
    d.rectangle((x,400,x+610,435),fill=green)
    center(x,369,610,title,34,'#FFFFFF',True)
    node(id,x,345,610,645,'','rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#B7CCBE;strokeWidth=3;')
    node(id+'head',x,345,610,90,title,'rounded=0;whiteSpace=wrap;html=1;fillColor=#1E6B47;strokeColor=#1E6B47;fontColor=#FFFFFF;fontFamily=Arial;fontSize=34;fontStyle=1;')
    for i,(heading,detail) in enumerate(rows):
        y=469+i*102
        d.ellipse((x+28,y+9,x+39,y+20),fill=gold)
        txt(x+54,y,heading,29,ink,True)
        txt(x+54,y+39,detail,25,muted)
        label(id+str(i),x+54,y,535,78,f'<b>{html.escape(heading)}</b><br><span style="font-size:25px;color:{muted}">{html.escape(detail)}</span>',29)

def edge(id,source,target,points=None):
    c=ET.SubElement(root,'mxCell',id=id,parent='1',edge='1',source=source,target=target,style='edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;endFill=1;strokeColor=#1E6B47;strokeWidth=4;'+('exitX=0.5;exitY=1;entryX=0.5;entryY=1;' if points else 'exitX=1;exitY=0.5;entryX=0;entryY=0.5;'))
    geo=ET.SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'})
    if points:
        ar=ET.SubElement(geo,'Array',attrib={'as':'points'})
        for x,y in points: ET.SubElement(ar,'mxPoint',x=str(x),y=str(y))

for a,b in [(705,895),(1505,1695)]:
    d.line((a+15,668,b-25,668),fill=green,width=6)
    d.polygon([(b-14,668),(b-36,655),(b-36,681)],fill=green)
edge('in-process','input','process');edge('process-out','process','output')

d.line([(2000,990),(2000,1125),(400,1125),(400,1008)],fill=green,width=5)
d.polygon([(400,996),(387,1019),(413,1019)],fill=green)
edge('feedback','output','input',[(2000,1125),(400,1125)])
d.rounded_rectangle((655,1065,1745,1187),radius=12,fill='#E3F1E9',outline='#B7CCBE',width=2)
center(655,1082,1090,'FEEDBACK',25,green,True)
center(655,1123,1090,'Reports and alerts guide restocking and pricing decisions.',27,ink)
node('feedback-label',655,1065,1090,122,'<b>FEEDBACK</b><br>Reports and alerts guide restocking and pricing decisions.','rounded=1;arcSize=10;whiteSpace=wrap;html=1;fillColor=#E3F1E9;strokeColor=#B7CCBE;fontFamily=Arial;fontSize=27;fontColor=#1E6B47;')
center(95,1250,2210,'Customers and store administrator  •  Mobile app + backend API + SQLite database',26,muted)
label('footer',330,1250,1900,50,'Customers and store administrator • Mobile app + backend API + SQLite database',26,muted)

im.save(OUT/'Bugasan_ni_Ali_Conceptual_Framework.png',dpi=(200,200))
im.save(OUT/'Bugasan_ni_Ali_Conceptual_Framework.jpg',quality=96,subsampling=0,dpi=(200,200))
ET.indent(model)
ET.ElementTree(model).write(OUT/'Bugasan_ni_Ali_Conceptual_Framework.drawio',encoding='utf-8',xml_declaration=True)
for ext in ['png','jpg']:
    p=OUT/f'Bugasan_ni_Ali_Conceptual_Framework.{ext}'
    with Image.open(p) as check:
        check.verify()
    print(p)
