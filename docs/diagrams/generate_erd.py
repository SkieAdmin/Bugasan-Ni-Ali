from pathlib import Path
import math
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

OUT=Path(__file__).parent
S=2
COLOR='#203F36'
im=Image.new('RGB',(1760*S,1240*S),'white')
draw=ImageDraw.Draw(im)
mx=ET.Element('mxfile',host='app.diagrams.net')
page=ET.SubElement(mx,'diagram',id='ERD',name='ERD')
model=ET.SubElement(page,'mxGraphModel',page='1',pageWidth='1760',pageHeight='1240')
root=ET.SubElement(model,'root')
ET.SubElement(root,'mxCell',id='0'); ET.SubElement(root,'mxCell',id='1',parent='0')
counter=2
def cell(value,style,**kwargs):
    global counter
    e=ET.SubElement(root,'mxCell',id=str(counter),parent='1',value=value,style=style,**kwargs)
    counter+=1
    return e
def rect(x,y,w,h,fill,stroke=COLOR):
    draw.rectangle((x*S,y*S,(x+w)*S,(y+h)*S),fill=fill,outline=stroke,width=2*S)
    e=cell('',f'fillColor={fill};strokeColor={stroke};strokeWidth=2;',vertex='1')
    ET.SubElement(e,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),**{'as':'geometry'})
def text(x,y,value,size=20,bold=False,color=COLOR):
    font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf',size*S)
    draw.text((x*S,y*S),value,font=font,fill=color,anchor='lm')
    e=cell(value,f'text;html=0;align=left;verticalAlign=middle;fontFamily=Arial;fontSize={size};fontStyle={1 if bold else 0};fontColor={color};',vertex='1')
    ET.SubElement(e,'mxGeometry',x=str(x),y=str(y-18),width=str(draw.textlength(value,font=font)/S+8),height='36',**{'as':'geometry'})
def arrow(points,label,x,y):
    pts=[(a*S,b*S) for a,b in points]
    draw.line(pts,fill=COLOR,width=3*S)
    a,b=pts[-2:]; angle=math.atan2(b[1]-a[1],b[0]-a[0])
    draw.polygon([b,(b[0]-11*S*math.cos(angle-.4),b[1]-11*S*math.sin(angle-.4)),(b[0]-11*S*math.cos(angle+.4),b[1]-11*S*math.sin(angle+.4))],fill=COLOR)
    e=cell('',f'endArrow=block;strokeColor={COLOR};strokeWidth=3;',edge='1')
    g=ET.SubElement(e,'mxGeometry',relative='1',**{'as':'geometry'})
    for key,p in [('sourcePoint',points[0]),('targetPoint',points[-1])]: ET.SubElement(g,'mxPoint',x=str(p[0]),y=str(p[1]),**{'as':key})
    arr=ET.SubElement(g,'Array',**{'as':'points'})
    for a,b in points[1:-1]: ET.SubElement(arr,'mxPoint',x=str(a),y=str(b))
    text(x,y,label,19,True)

# Compact entity cards: keys plus selected descriptive fields, matching the reference.
cards=[
 ('device_tokens',40,35,['PK token | FK user_id','platform, device_name','created_at, last_seen_at']),
 ('users',640,35,['PK id','name, email, role','account_type, wholesale_status']),
 ('orders',1240,35,['PK id | FK customer_id','total, payment_status, status','fulfillment, schedule_date']),
 ('stock_movements',40,345,['PK id | FK product_id','type, kg, ref','note, at']),
 ('products',640,345,['PK id | FK supplier_id (nullable)','name, retail_price, wholesale_price','stock_kg, reorder_level, cost_per_kg']),
 ('order_items',1240,345,['PK id | FK order_id, product_id','name, unit, qty, kg','price_per_kg, discount, total']),
 ('supplier_varieties',40,655,['PK (supplier_id, product_id)','FK supplier_id','FK product_id']),
 ('suppliers',640,655,['PK id','name, contact_person, phone','email, address, lead_time_days']),
 ('purchase_orders',1240,655,['PK id | FK supplier_id','total_kg, total_cost, status','ordered_at, expected_at, received_at']),
 ('pricing_rules',40,965,['PK id','name, min_kg, type, value','applies_to, active']),
 ('settings',640,965,['PK key','value (JSON)','Store configuration']),
 ('purchase_order_items',1240,965,['PK id | FK po_id, product_id','name, sacks, kg','cost_per_kg, total'])]

arrow([(640,112),(480,112)],'1 → N',525,87)
arrow([(1080,112),(1240,112)],'1 → N',1125,87)
arrow([(1460,205),(1460,345)],'1 → N',1478,272)
arrow([(1080,427),(1240,427)],'1 → N',1125,402)
arrow([(640,427),(480,427)],'1 → N',525,402)
arrow([(860,655),(860,515)],'0..1 → N',878,583)
arrow([(640,737),(480,737)],'1 → N',525,712)
arrow([(700,515),(700,575),(260,575),(260,655)],'1 → N',428,550)
arrow([(1080,737),(1240,737)],'1 → N',1125,712)
arrow([(1460,825),(1460,965)],'1 → N',1478,892)
arrow([(1020,515),(1020,565),(1720,565),(1720,1050),(1680,1050)],'1 → N',1360,540)
for name,x,y,fields in cards:
    rect(x+4,y+5,440,170,'#E5E5E5','#E5E5E5')
    rect(x,y,440,170,'#FFFFFF')
    rect(x,y,440,48,COLOR)
    text(x+16,y+24,name,26,True,'#FFFFFF')
    for i,f in enumerate(fields): text(x+16,y+77+i*34,f,20)
text(40,1180,'ERD — Bugasan ni Ali',22,True)
text(640,1170,'PK = primary key   |   FK = foreign key   |   N = many (zero or more)',17)
text(640,1201,'Selected fields shown. All 12 tables and 11 foreign keys follow the project database.',17)
im.save(OUT/'ERD.jpg',quality=97,subsampling=0,dpi=(300,300))
ET.ElementTree(mx).write(OUT/'ERD.drawio',encoding='utf-8',xml_declaration=True)
im.resize((1320,930)).save(OUT/'erd_preview.png')
print('Saved ERD.jpg and ERD.drawio')
