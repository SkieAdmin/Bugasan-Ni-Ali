from pathlib import Path
import math
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent
SCALE = 2
INK = '#000000'
BLUE = '#FFFFFF'
GREEN = '#FFFFFF'
GOLD = '#FFFFFF'
FONT = 'C:/Windows/Fonts/arial.ttf'
BOLD = 'C:/Windows/Fonts/arialbd.ttf'

class Diagram:
    def __init__(self, name, title, subtitle, w, h):
        self.name, self.w, self.h = name, w, h
        self.im = Image.new('RGB', (w*SCALE, h*SCALE), 'white')
        self.d = ImageDraw.Draw(self.im)
        self.root = ET.Element('mxGraphModel', dx='0', dy='0', grid='1', gridSize='10', page='1', pageWidth=str(w), pageHeight=str(h))
        self.cells = ET.SubElement(self.root, 'root')
        ET.SubElement(self.cells, 'mxCell', id='0')
        ET.SubElement(self.cells, 'mxCell', id='1', parent='0')
        self.n = 2
        self.text(w/2, 44, title, 29, True)
        self.text(w/2, 82, subtitle, 15)
    def cell(self, **attrs):
        e = ET.SubElement(self.cells, 'mxCell', id=str(self.n), parent='1', **attrs)
        self.n += 1
        return e
    def text(self, x, y, text, size=17, bold=False):
        font = ImageFont.truetype(BOLD if bold else FONT, size*SCALE)
        self.d.multiline_text((x*SCALE,y*SCALE), text, font=font, fill=INK, anchor='mm', align='center', spacing=6*SCALE)
        lines = text.split('\n')
        width = max(self.d.textlength(line,font=font) for line in lines)/SCALE+20
        height = len(lines)*(size+6)+8
        c = self.cell(value=text, style=f'text;html=0;align=center;verticalAlign=middle;fontFamily=Arial;fontSize={size};fontColor={INK};fontStyle={1 if bold else 0};', vertex='1')
        ET.SubElement(c, 'mxGeometry', x=str(x-width/2), y=str(y-height/2), width=str(width), height=str(height), **{'as':'geometry'})
    def box(self, x,y,w,h,text,kind='entity',fill=BLUE,size=18):
        rect = tuple(v*SCALE for v in (x,y,x+w,y+h))
        if kind=='process':
            self.d.rounded_rectangle(rect, radius=20*SCALE, fill=fill, outline=INK,width=2*SCALE)
        else:
            self.d.rectangle(rect, fill=fill, outline=INK,width=2*SCALE)
        if kind=='store':
            self.d.line(((x+12)*SCALE,y*SCALE,(x+12)*SCALE,(y+h)*SCALE), fill=INK,width=2*SCALE)
        style=f'rounded={1 if kind=="process" else 0};whiteSpace=wrap;html=0;fillColor={fill};strokeColor={INK};strokeWidth=2;fontSize={size};fontFamily=Arial;fontColor={INK};'
        if kind=='store': style+='shape=partialRectangle;left=1;right=0;top=1;bottom=1;'
        c = self.cell(value=text,style=style,vertex='1')
        ET.SubElement(c,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),**{'as':'geometry'})
        font=ImageFont.truetype(FONT,size*SCALE)
        self.d.multiline_text(((x+w/2)*SCALE,(y+h/2)*SCALE),text,font=font,fill=INK,anchor='mm',align='center',spacing=6*SCALE)
    def arrow(self, points, label='', lx=None, ly=None, size=14):
        pts=[(x*SCALE,y*SCALE) for x,y in points]
        self.d.line(pts,fill=INK,width=2*SCALE)
        a,b=pts[-2:]; angle=math.atan2(b[1]-a[1],b[0]-a[0])
        self.d.polygon([b,(b[0]-12*SCALE*math.cos(angle-.45),b[1]-12*SCALE*math.sin(angle-.45)),(b[0]-12*SCALE*math.cos(angle+.45),b[1]-12*SCALE*math.sin(angle+.45))],fill=INK)
        c=self.cell(value='',style=f'endArrow=block;html=0;strokeWidth=2;strokeColor={INK};',edge='1')
        g=ET.SubElement(c,'mxGeometry',relative='1',**{'as':'geometry'})
        ET.SubElement(g,'mxPoint',x=str(points[0][0]),y=str(points[0][1]),**{'as':'sourcePoint'})
        ET.SubElement(g,'mxPoint',x=str(points[-1][0]),y=str(points[-1][1]),**{'as':'targetPoint'})
        if len(points)>2:
            arr=ET.SubElement(g,'Array',**{'as':'points'})
            for x,y in points[1:-1]: ET.SubElement(arr,'mxPoint',x=str(x),y=str(y))
        if label: self.text(lx,ly,label,size)
    def save(self):
        self.im.save(OUT/(self.name+'.jpg'),quality=96,subsampling=0,dpi=(300,300))
        mx=ET.Element('mxfile',host='app.diagrams.net')
        page=ET.SubElement(mx,'diagram',id=self.name,name=self.name.replace('_',' ').title())
        page.append(self.root)
        ET.ElementTree(mx).write(OUT/(self.name+'.drawio'),encoding='utf-8',xml_declaration=True)

d=Diagram('conceptual_framework','BUGASAN NI ALI | CONCEPTUAL FRAMEWORK','Input–Process–Output model for the rice ordering, sales and inventory management system',1500,890)
columns=[(60,'INPUT',BLUE,[('Customer information','Account and contact details\nRetail / wholesale classification\nWholesale applications'),('Store and inventory data','Rice varieties and stock levels\nPrices, discounts and delivery fees\nSupplier records'),('Transaction details','Order items and quantities\nDelivery / pickup schedule\nPayment reference and stock receipts')]),(570,'PROCESS',GOLD,[('Account and order management','Authenticate users and approve wholesale\nCalculate prices and discounts\nValidate and record orders'),('Sales and stock control','Record payment verification\nTrack delivery / pickup status\nDeduct, restore and adjust stock'),('Procurement and reporting','Record and receive purchase orders\nUpdate inventory and cost prices\nAggregate sales and inventory data')]),(1080,'OUTPUT',GREEN,[('Customer transaction records','Order confirmation and receipts\nOrder and payment status\nCustomer notifications'),('Operational information','Updated stock and movement history\nLow-stock alerts\nSupplier and purchase-order records'),('Management reports','Sales and inventory summaries\nBest-selling rice varieties\nRetail / wholesale and supplier reports')])]
for x,title,fill,groups in columns:
    d.box(x,135,360,60,title,fill=fill,size=24)
    for i,(heading,body) in enumerate(groups):
        y=215+i*170
        d.box(x,y,360,150,'',fill=fill)
        d.text(x+180,y+29,heading,18,True)
        d.text(x+180,y+90,body,16)
d.arrow([(420,450),(570,450)],'Data',495,425)
d.arrow([(930,450),(1080,450)],'Results',1005,425)
d.arrow([(1260,735),(1260,790),(240,790),(240,735)])
d.text(750,823,'FEEDBACK: Reports and stock alerts guide replenishment, pricing and store operations.',17)
d.save()

d=Diagram('dfd_context','','',1800,850)
d.box(50,55,350,190,'',size=24)
d.text(225,150,'Customer',28,True)
d.box(1400,55,350,190,'',size=24)
d.text(1575,150,'Store Admin',28,True)
d.box(650,380,500,420,'',kind='process',size=24)
d.text(900,410,'0',23)
# Number compartment, matching the reference's process symbol.
d.d.line((650*SCALE,440*SCALE,1150*SCALE,440*SCALE),fill=INK,width=2*SCALE)
c=d.cell(value='',style='endArrow=none;strokeColor=#000000;strokeWidth=2;',edge='1')
g=ET.SubElement(c,'mxGeometry',relative='1',**{'as':'geometry'})
ET.SubElement(g,'mxPoint',x='650',y='440',**{'as':'sourcePoint'})
ET.SubElement(g,'mxPoint',x='1150',y='440',**{'as':'targetPoint'})
d.text(900,555,'Bugasan ni Ali',29,True)
d.text(900,635,'Rice Ordering, Sales and\nInventory Management System',24,True)
customer_in=['Registration / login details','Profile and wholesale application details','Catalog and pricing requests','Order and payment details','Delivery / pickup preferences','Order cancellation requests']
admin_in=['Admin login credentials','Product, pricing and store settings','Supplier and purchase-order details','Stock receipt and adjustment details','Payment and order status updates','Wholesale approvals / report requests']
customer_out=['Account and wholesale application status','Rice catalog and prices','Order confirmation and totals','Payment and order status','Receipts and order history','Customer notifications']
admin_out=['Account and customer records','Dashboard and sales reports','Inventory records and stock alerts','Supplier and purchase-order records','Order and payment records','Wholesale applications and notifications']
for i,label in enumerate(customer_in):
    y=78+i*29; x=850-i*28
    d.arrow([(400,y),(x,y),(x,380)],label,610,y-12,17)
for i,label in enumerate(admin_in):
    y=78+i*29; x=950+i*28
    d.arrow([(1400,y),(x,y),(x,380)],label,(x+1400)/2,y-12,16)
for i,label in enumerate(customer_out):
    y=480+i*53; x=260-i*28
    d.arrow([(650,y),(x,y),(x,245)],label,455,y-13,17)
for i,label in enumerate(admin_out):
    y=480+i*53; x=1540+i*28
    d.arrow([(1150,y),(x,y),(x,245)],label,1350,y-13,17)
d.save()

d=Diagram('dfd_level_1','BUGASAN NI ALI | LEVEL 1 DATA FLOW DIAGRAM','Logical decomposition • Repeated entities and stores refer to the same actors and records',1800,1770)
rows=[
 ('1.0\nManage Accounts\nand Wholesale Access','CUSTOMER /\nSTORE ADMIN','Account / profile details;\napplication / approval decision','Account details and\napplication status',[
 ('D1 | User accounts','Account and eligibility data','New / updated account data')]),
 ('2.0\nProcess Orders\nand Payments','CUSTOMER /\nSTORE ADMIN','Order / cancellation details;\npayment / fulfillment updates','Catalog, quote, receipt, status;\norder and payment notifications',[
 ('D1 | User accounts','Customer / wholesale eligibility',None),
 ('D2 | Products & stock movements','Catalog / stock data','Stock deductions / returns'),
 ('D3 | Orders & order items','Order and payment records','Order / payment / status data'),
 ('D4 | Pricing rules & settings','Discounts / fees / store settings',None)]),
 ('3.0\nManage Catalog\nand Inventory','STORE ADMIN','Product / price / settings edits;\nstock adjustment details','Catalog and stock records;\nmovement history / stock alerts',[
 ('D2 | Products & stock movements','Product / stock records','Product / adjustment data'),
 ('D4 | Pricing rules & settings','Pricing rules / settings','Updated rules / settings')]),
 ('4.0\nManage Suppliers\nand Procurement','STORE ADMIN','Supplier / purchase-order details;\nreceipt / cancellation details','Supplier and purchase-order\nrecords / receipt confirmation',[
 ('D5 | Suppliers & purchase orders','Supplier / purchase-order data','Supplier / purchase-order updates'),
 ('D2 | Products & stock movements','Product / stock / cost data','Received stock / updated costs')]),
 ('5.0\nGenerate Reports','STORE ADMIN','Report request and date range','Dashboard, sales, inventory,\nbest-seller and supplier reports',[
 ('D2 | Products & stock movements','Inventory / stock movements',None),
 ('D3 | Orders & order items','Sales and order data',None),
 ('D5 | Suppliers & purchase orders','Supplier purchases',None)])
]
for i,(process,actor,inflow,outflow,stores) in enumerate(rows):
    y=135+i*300
    d.box(40,y+80,220,130,actor,fill=GREEN if i<2 else GOLD,size=19)
    d.box(650,y+65,270,160,process,kind='process',size=21)
    d.arrow([(260,y+110),(650,y+110)],inflow,455,y+77,15)
    d.arrow([(650,y+185),(260,y+185)],outflow,455,y+227,15)
    for j,(store,read,write) in enumerate(stores):
        sy=y+12+j*69
        d.box(1435,sy,325,58,store,kind='store',fill='#FFFFFF',size=16)
        d.arrow([(1435,sy+15),(1000,sy+15),(1000,y+85+j*30),(920,y+85+j*30)])
        d.text(1215,sy+3,read,13)
        if write:
            d.arrow([(920,y+100+j*30),(970, y+100+j*30),(970,sy+49),(1435,sy+49)])
            d.text(1215,sy+37,write,13)
d.text(900,1665,'Notation: rectangle = external entity  |  rounded rectangle = process  |  divided rectangle = data store  |  arrow = data flow',15)
d.text(900,1700,'D2 includes stock_movements; D5 includes supplier varieties and purchase-order items. Payment data is stored in D3.',15)
d.text(900,1730,'Business-level view: authentication tokens, device registration and notification transport are omitted.',14)
d.save()
print('Created three JPEG diagrams and three editable draw.io sources in', OUT)
