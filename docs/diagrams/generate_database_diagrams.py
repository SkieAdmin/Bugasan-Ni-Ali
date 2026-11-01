"""Generate schema-backed ERD and a business-level DFD, plus editable sources."""
import sqlite3
from pathlib import Path
from generate_diagrams import Diagram, ET, SCALE, INK, rows

def line(d, points):
    d.d.line([(x*SCALE,y*SCALE) for x,y in points],fill=INK,width=2*SCALE)
    c=d.cell(value='',style='endArrow=none;strokeColor=#000000;strokeWidth=2;',edge='1')
    g=ET.SubElement(c,'mxGeometry',relative='1',**{'as':'geometry'})
    for key,p in [('sourcePoint',points[0]),('targetPoint',points[-1])]:
        ET.SubElement(g,'mxPoint',x=str(p[0]),y=str(p[1]),**{'as':key})
    if len(points)>2:
        a=ET.SubElement(g,'Array',**{'as':'points'})
        for x,y in points[1:-1]: ET.SubElement(a,'mxPoint',x=str(x),y=str(y))

db=sqlite3.connect(':memory:')
db.executescript((Path(__file__).parents[2]/'backend/src/db/schema.sql').read_text())
positions={
 'users':(60,130), 'device_tokens':(60,650),
 'orders':(620,130), 'order_items':(1200,130), 'products':(1800,130),
 'stock_movements':(2400,130), 'supplier_varieties':(2400,650),
 'suppliers':(1800,900), 'purchase_orders':(1200,900),
 'purchase_order_items':(620,1000), 'pricing_rules':(60,1100), 'settings':(60,1480)
}
d=Diagram('database_structure_erd','BUGASAN NI ALI — DATABASE STRUCTURE / ERD','Actual SQLite tables, fields, primary keys and foreign-key relationships',2900,1830)
sizes={}
for table,(x,y) in positions.items():
    cols=db.execute(f'PRAGMA table_info({table})').fetchall()
    fks={r[3] for r in db.execute(f'PRAGMA foreign_key_list({table})')}
    h=58+len(cols)*24
    sizes[table]=(x,y,420,h)
    d.box(x,y,420,h,'')
    d.text(x+210,y+27,table,22,True)
    line(d,[(x,y+52),(x+420,y+52)])
    for i,(_,name,typ,required,default,pk) in enumerate(cols):
        tags=[]
        if pk: tags.append('PK')
        if name in fks: tags.append('FK')
        prefix=('['+'/'.join(tags)+'] ') if tags else ''
        d.text(x+210,y+69+i*24,f'{prefix}{name} : {typ}',17,bool(tags))

def rel(parent,child,points,label,lx,ly,optional=False):
    line(d,points)
    # Cardinality at each end; lines represent FK relationships, not data flows.
    x,y=points[0]; a,b=points[1]; dx,dy=a-x,b-y
    d.text(x+(30 if dx>0 else -30 if dx<0 else 30),y+(20 if dy>=0 else -20),'0..1' if optional else '1',16,True)
    x,y=points[-1]; a,b=points[-2]; dx,dy=a-x,b-y
    d.text(x+(33 if dx>0 else -33 if dx<0 else 30),y+(20 if dy>=0 else -20),'0..*',16,True)
    d.text(lx,ly,label,16)

rel('users','orders',[(480,220),(620,220)],'places',550,193)
rel('users','device_tokens',[(260,476),(260,650)],'registers',330,565)
rel('orders','order_items',[(1040,250),(1200,250)],'contains',1120,223)
rel('products','order_items',[(1800,300),(1620,300)],'listed in',1710,273)
rel('products','stock_movements',[(2220,230),(2400,230)],'has',2310,203)
rel('suppliers','products',[(2020,900),(2020,500)],'primary supplier',2120,700,True)
rel('suppliers','supplier_varieties',[(2220,1000),(2310,1000),(2310,690),(2400,690)],'offers',2350,850)
rel('products','supplier_varieties',[(2220,400),(2510,400),(2510,650)],'available from',2610,530)
rel('suppliers','purchase_orders',[(1800,1000),(1620,1000)],'receives',1710,973)
rel('purchase_orders','purchase_order_items',[(1200,1100),(1040,1100)],'contains',1120,1073)
rel('products','purchase_order_items',[(1900,500),(1900,820),(830,820),(830,1000)],'purchased item',1380,797)
d.text(1740,1510,'RELATIONSHIP KEY',23,True)
d.text(1740,1560,'1 = one    0..1 = optional one    0..* = zero or many',20)
d.text(1740,1605,'PK = primary key    FK = foreign key    [PK/FK] = both',20)
d.text(1740,1650,'supplier_varieties uses a composite primary key.',18)
d.text(1740,1690,'pricing_rules and settings have no declared foreign keys.',18)
d.text(1740,1730,'stock_movements.ref is a text reference, not a declared foreign key.',18)
d.text(1450,1790,'Each line connects a parent key to a child foreign key. Field names and types match backend/src/db/schema.sql.',18)
d.save()
assert len(positions)==len(db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall())
assert sum(len(db.execute(f'PRAGMA foreign_key_list({t})').fetchall()) for t in positions)==11

d=Diagram('dfd_level_1','BUGASAN NI ALI — LEVEL 1 DATA FLOW DIAGRAM','Processes, external entities and data stores • Separate arrows show the direction of each data flow',1900,2050)
for i,(process,actor,inflow,outflow,stores) in enumerate(rows):
    y=130+i*355
    num,*name=process.split('\n')
    d.box(690,y+75,300,190,'',kind='process')
    d.text(840,y+98,num,21)
    line(d,[(690,y+125),(990,y+125)])
    d.text(840,y+192,'\n'.join(name),22,True)
    if i<2:
        for j,who in enumerate(['Customer','Store Admin']):
            ey=y+20+j*180
            d.box(40,ey,230,120,who,size=23)
            if i==0:
                ins=['Registration / login / profile details','Login / wholesale approval decision'][j]
                outs=['Account / wholesale status','Customer / application records'][j]
            else:
                ins=['Order / payment / cancellation details','Payment verification / fulfillment updates'][j]
                outs=['Catalog / quote / receipt / order status','Order and payment records / alerts'][j]
            py=y+145+j*65
            d.arrow([(270,ey+35),(610,ey+35),(610,py),(690,py)],ins,465,ey+17,15)
            d.arrow([(690,py+25),(640,py+25),(640,ey+90),(270,ey+90)],outs,465,ey+111,15)
    else:
        d.box(40,y+100,230,140,'Store Admin',size=23)
        d.arrow([(270,y+130),(690,y+130)],inflow,475,y+94,16)
        d.arrow([(690,y+215),(270,y+215)],outflow,475,y+258,16)
    for j,(store,read,write) in enumerate(stores):
        sy=y+20+j*77
        d.box(1510,sy,350,63,store,kind='store',size=17)
        py=y+140+j*28
        d.arrow([(1510,sy+16),(1080,sy+16),(1080,py),(990,py)])
        d.text(1300,sy+3,read,14)
        if write:
            d.arrow([(990,py+13),(1045,py+13),(1045,sy+52),(1510,sy+52)])
            d.text(1300,sy+40,write,14)
d.text(950,1945,'Rectangles: external entities   |   Numbered rounded boxes: processes   |   Divided boxes: data stores',18)
d.text(950,1980,'Repeated entities and stores represent the same actor or data. D3 includes payment records; D5 includes purchase-order items.',16)
d.text(950,2015,'Supplier and rider details are recorded by the admin. This business-level DFD abstracts notification transport and device registration.',16)
d.save()
print('Verified 12 tables and 11 foreign keys; generated ERD and detailed DFD JPEG/draw.io files.')
