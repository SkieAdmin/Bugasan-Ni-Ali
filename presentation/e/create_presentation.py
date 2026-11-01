"""Build an editable six-slide presentation from the repository's implemented design."""
import os, sys
from pathlib import Path
sys.path.insert(0, str(Path(os.environ['TEMP']) / 'bugasan-pptx-libs'))
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR

OUT = Path(__file__).parent
prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
GREEN, DARK, GOLD, BG, INK, MUTED, PALE = '1E6B47','154D33','D99A1E','F6F4EE','1D2621','4F5852','E3F1E9'

def rect(s,x,y,w,h,fill,line=None,round=False):
    o=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if round else MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    o.fill.solid(); o.fill.fore_color.rgb=RGBColor.from_string(fill)
    o.line.fill.background() if line is None else None
    if line: o.line.color.rgb=RGBColor.from_string(line)
    if round: o.adjustments[0]=0.12
    return o

def text(s,x,y,w,h,content,size=20,color=INK,bold=False,font='Aptos'):
    o=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h))
    tf=o.text_frame; tf.word_wrap=True
    tf.margin_left=tf.margin_right=0; tf.margin_top=tf.margin_bottom=0
    for i,line in enumerate(content.split('\n')):
        p=tf.paragraphs[0] if i==0 else tf.add_paragraph()
        p.text=line; p.font.name=font; p.font.size=Pt(size); p.font.bold=bold; p.font.color.rgb=RGBColor.from_string(color)
        p.space_after=Pt(10)
    return o

def slide(section,title,subtitle):
    s=prs.slides.add_slide(prs.slide_layouts[6]); s.background.fill.solid(); s.background.fill.fore_color.rgb=RGBColor.from_string(BG)
    rect(s,0,0,13.333,.10,GREEN)
    text(s,.55,.36,12,.3,section.upper(),11,GREEN,True)
    text(s,.55,.87,12, .65,title,32,INK,True)
    text(s,.55,1.63,12,.6,subtitle,16,MUTED)
    text(s,.55,7.08,10,.22,'BUGASAN NI ALI  /  SYSTEM OVERVIEW',10,MUTED)
    text(s,12.1,7.04,.7,.3,f'{len(prs.slides):02d} / 06',10,GREEN,True)
    return s

def card(s,x,y,w,h,label,body,fill='FFFFFF',size=20):
    rect(s,x,y,w,h,fill,round=True)
    text(s,x+.25,y+.23,w-.5,.48,label,22,GREEN,True)
    text(s,x+.25,y+.93,w-.5,h-1.05,body,size,MUTED)

def arrow(s,x,y,w=.42):
    rectshape=s.shapes.add_shape(MSO_SHAPE.CHEVRON, Inches(x), Inches(y), Inches(w), Inches(.4))
    rectshape.fill.solid();rectshape.fill.fore_color.rgb=RGBColor.from_string(GOLD);rectshape.line.fill.background()

def entity(s,x,y,w,title,fields,h=1.65):
    rect(s,x,y,w,h,'FFFFFF',line='D8E1D8',round=True)
    rect(s,x,y,w,.43,GREEN)
    text(s,x+.14,y+.065,w-.28,.29,title,16,'FFFFFF',True)
    text(s,x+.14,y+.57,w-.28,h-.62,fields,14,INK,font='Consolas')

def link(s,x1,y1,x2,y2,label,lx,ly,lw=1.1):
    c=s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.line.color.rgb=RGBColor.from_string(GREEN); c.line.width=Pt(2)
    text(s,lx,ly,lw,.28,label,12,GREEN,True)

s=slide('Rice ordering & store management','Bugasan ni Ali','A mobile system for a local rice store')
rect(s,.55,2.45,8.05,3.85,DARK,round=True)
text(s,.95,2.87,7.2,1.4,'From rice orders\nto stock control.',38,'FFFFFF',True)
text(s,.95,4.75,7.1,.95,'One app connecting customers, sales, inventory, and supplier purchases.',23,'FFFFFF')
text(s,9.18,2.75,3.5,.35,'IN THIS PRESENTATION',12,GREEN,True)
for y,n,label in [(3.45,'01','About the app'),(4.32,'02','Conceptual framework'),(5.19,'03','Database structure')]:
    text(s,9.18,y,.6,.4,n,20,GOLD,True);text(s,9.88,y,2.95,.65,label,21,INK,True)
s.notes_slide.notes_text_frame.text='Introduce Bugasan ni Ali as a rice ordering, retail/wholesale sales, and inventory management application. This overview is based on the source code and database schema, not on measured business outcomes. Sources: README.md; frontend/src/theme/index.js; backend/src/db/schema.sql.'

s=slide('01 / About','One store, two user experiences','Purpose: organize rice purchases and daily store operations in one system.')
card(s,.55,2.5,5.95,3.25,'Customers','Browse rice varieties and prices\nOrder for delivery or pickup\nTrack orders and view receipts\nApply for wholesale access',size=21)
card(s,6.82,2.5,5.95,3.25,'Store administrator','Manage products, stock, and suppliers\nProcess orders and verify payments\nReceive supplier purchase orders\nReview sales and inventory reports',size=21)
rect(s,.55,6.02,12.22,.66,PALE,round=True)
text(s,.82,6.17,11.7,.35,'Retail + approved wholesale pricing  â€¢  Stock alerts  â€¢  Order status updates',20,GREEN,True)
s.notes_slide.notes_text_frame.text='Customers select rice, place an order, and follow fulfillment. The administrator maintains the catalog, handles orders, approves wholesale access, records supplier purchases, and reviews reports. Payment verification is an administrative workflow; do not describe it as an integrated payment gateway. Push notifications require device configuration. Sources: backend/README.md; frontend/src/app; backend/src/services/orders.js.'

s=slide('02 / Conceptual framework','Input â†’ Process â†’ Output','An Inputâ€“Processâ€“Output model of the implemented workflow.')
card(s,.55,2.65,3.78,2.95,'INPUT','Customer information\nRice products and prices\nOrder quantities and schedules\nSupplier and purchase details',size=19)
arrow(s,4.46,3.83,.35)
card(s,4.93,2.65,3.48,2.95,'PROCESS','Validate account and stock\nCalculate prices and discounts\nSave orders and update stock\nManage fulfillment and restocks',fill=PALE,size=19)
arrow(s,8.55,3.83,.35)
card(s,9.02,2.65,3.75,2.95,'OUTPUT','Orders and sales receipts\nUpdated inventory balances\nOrder status and stock alerts\nSales and inventory reports',size=19)
rect(s,1.1,6.02,11.1,.66,DARK,round=True)
text(s,1.38,6.18,10.6,.35,'FEEDBACK: reports and low-stock alerts inform restocking and pricing decisions.',18,'FFFFFF')
s.notes_slide.notes_text_frame.text='Explain the model from left to right. Inputs enter through the app; the backend checks stock and calculates prices, then records transactions. Outputs include receipts, current stock, status updates, and reports. Feedback means the administrator uses reports and alerts to make decisions; automatic replenishment is not claimed. Sources: backend/README.md; backend/src/services/orders.js; backend/src/services/purchaseOrders.js; backend/src/services/reports.js.'

s=slide('03 / Database structure','How the system stores its data','A React Native / Expo app connects to a Node.js / Express API backed by SQLite.')
for x,w,label,body in [(.55,3.65,'Mobile app','Customer and admin screens'),(4.83,3.65,'Backend API','Business rules and validation'),(9.11,3.66,'SQLite database','12 related tables')]:
    card(s,x,2.42,w,1.65,label,body,fill=PALE,size=17)
arrow(s,4.35,3.02,.32);arrow(s,8.63,3.02,.32)
text(s,.65,4.45,7,.4,'CORE BUSINESS DATA',12,GREEN,True)
text(s,.65,4.98,7,1.7,'Sales: users, orders, order_items, products\nSupply: suppliers, supplier_varieties,\npurchase_orders, purchase_order_items,\nstock_movements',17,INK)
rect(s,8.35,4.45,4.42,2.17,'FFFFFF',round=True)
text(s,8.6,4.65,3.95,.35,'SUPPORTING TABLES',12,GREEN,True)
text(s,8.6,5.12,3.95,1.2,'pricing_rules â€” discount conditions\nsettings â€” store configuration (JSON)\ndevice_tokens â€” user push devices',17,INK)
s.notes_slide.notes_text_frame.text='SQLite is the persistent database and the backend is the source of truth. Foreign key enforcement is enabled. The schema has 12 tables: nine core business tables and three supporting tables. device_tokens.user_id references users.id; pricing_rules and settings have no declared foreign keys. settings.value stores JSON. Sources: backend/src/db/schema.sql; backend/src/db/index.js; frontend/package.json; backend/README.md.'

s=slide('03 / Database structure','Customer orders and sales','Selected key fields â€¢ PK = primary key â€¢ FK = foreign key â€¢ 1 : many = one-to-many')
entity(s,.55,2.75,2.75,'users','PK id\nrole, name, email\naccount_type')
entity(s,4.02,2.75,3.05,'orders','PK id\nFK customer_id\ntotal, status')
entity(s,7.8,2.75,2.5,'order_items','PK id\nFK order_id\nFK product_id\nkg, price_per_kg',1.95)
entity(s,10.95,2.75,1.83,'products','PK id\nname\nstock_kg')
link(s,3.3,3.5,4.02,3.5,'1 : many',3.34,3.08)
link(s,7.07,3.5,7.8,3.5,'1 : many',7.12,3.08)
link(s,10.3,3.5,10.95,3.5,'many : 1',10.3,3.08)
card(s,.55,5.02,5.95,1.63,'A sale is stored in two levels','orders holds the transaction; order_items holds each rice variety and quantity.',size=17)
card(s,6.82,5.02,5.95,1.63,'Historical receipts stay consistent','Each item keeps the product name and sale price recorded at checkout.',size=17)
s.notes_slide.notes_text_frame.text='A user can place multiple orders. Each order contains order item records, and each item references one product. This resolves the many-to-many relationship between orders and products. Orders also store customer/contact details, fulfillment, payment information, and totals. order_items stores the name and price at time of sale. Products are deactivated instead of deleted in normal app use. Sources: backend/src/db/schema.sql; backend/src/services/orders.js.'

s=slide('03 / Database structure','Supplier purchases and inventory','Restocking and sales connect through the same product records.')
entity(s,.55,2.55,2.6,'suppliers','PK id\nname, phone',1.45)
entity(s,4.03,2.55,3.25,'purchase_orders','PK id\nFK supplier_id\nstatus, total_cost',1.65)
entity(s,8.2,2.55,4.57,'purchase_order_items','PK id  |  FK po_id\nFK product_id\nkg, cost_per_kg',1.65)
link(s,3.15,3.25,4.03,3.25,'1 : many',3.2,2.84)
link(s,7.28,3.25,8.2,3.25,'1 : many',7.35,2.84)
entity(s,.55,5.08,3.4,'supplier_varieties','PK/FK supplier_id\nPK/FK product_id',1.45)
entity(s,5.1,5.08,2.8,'products','PK id\nFK supplier_id\nstock_kg',1.65)
entity(s,9.15,5.08,3.62,'stock_movements','PK id  |  FK product_id\ntype, kg, ref, at',1.65)
link(s,3.95,5.79,5.1,5.79,'many : 1',4.04,5.38)
link(s,7.9,5.79,9.15,5.79,'1 : many',8.12,5.38)
link(s,10.45,4.2,6.5,5.08,'many : 1',8.35,4.56)
link(s,1.85,4.0,1.85,5.08,'1 : many',1.98,4.44)
s.notes_slide.notes_text_frame.text='A supplier has many purchase orders; each purchase order has many items, and each item references a product. Receiving a purchase order adds stock and records a restock movement. supplier_varieties is a junction table with a composite primary key, supporting many suppliers per product and many products per supplier. Separately, products.supplier_id is an optional direct supplier reference (not drawn to keep the diagram readable). stock_movements records sale, return, restock, and adjustment quantities; ref is a text reference, not a declared foreign key. Stock changes use transactions, and product stock has a nonnegative constraint. Sources: backend/src/db/schema.sql; backend/src/db/index.js; backend/src/services/purchaseOrders.js; backend/src/services/products.js.'

prs.core_properties.title='Bugasan ni Ali â€” System Overview'
prs.core_properties.subject='About, conceptual framework, and database structure'
prs.core_properties.author='Bugasan ni Ali'
prs.core_properties.keywords='rice ordering, inventory, IPO, SQLite, database'
path=OUT/'Bugasan_ni_Ali_System_Overview.pptx'
prs.save(path)

# Reopen the actual deliverable and verify its slide count and canvas boundaries.
check=Presentation(path)
assert len(check.slides)==6
for i,s in enumerate(check.slides,1):
    for sh in s.shapes:
        assert sh.left>=0 and sh.top>=0, (i,sh.name)
        assert sh.left+sh.width<=check.slide_width+1000, (i,sh.name,'right edge')
        assert sh.top+sh.height<=check.slide_height+1000, (i,sh.name,'bottom edge')
print(f'Created and validated: {path} ({path.stat().st_size:,} bytes; 6 slides)')

