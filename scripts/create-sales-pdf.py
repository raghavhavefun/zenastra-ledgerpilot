from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors
from pathlib import Path
p=Path('/Users/satvindarluthra/tally-mcp-financial-os'); out=p/'Zenastra-Industries-Sales-Deck.pdf'; W,H=landscape(A4)
navy=colors.HexColor('#071B35'); ink=colors.HexColor('#102A43'); muted=colors.HexColor('#52606D'); mint=colors.HexColor('#D8F7ED'); white=colors.white
slides=[('ZENASTRA INDUSTRIES','Grow from ₹10 crore to ₹100 crore.','Reduce avoidable cost from ₹100 to ₹10.','We help companies save lakhs to crores by building private AI operating systems for finance, growth and everyday execution.'),('Three AI operating systems. One transformation partner.','AI ACCOUNTANT','Reports • GST • filing • analysis • Tally data entry','COMPANY OPERATING SYSTEM','Voice AI • sales • outreach • marketing • dashboards','PERSONAL OPERATING SYSTEM','Owner’s AI chief-of-staff'),('Use case 1 — AI Accountant.','A private finance intelligence layer connected to your local Tally data.','All major reports • GST support • receivables • payables • inventory • cash • bill-to-draft-to-Tally workflow','Outcome: replace repetitive manual work and create a path from ₹10 crore to ₹100 crore.'),('Use cases 2 & 3 — automate the company and the owner.','COMPANY OPERATING SYSTEM','Voice AI, sales, outreach, social marketing, WhatsApp, Gmail, CRM and dashboards.','PERSONAL OPERATING SYSTEM','Hiring, management, follow-ups, employee updates and private owner control.'),('Perks, protection and the implementation promise.','₹20 LAKH+ ONE-TIME SETUP','NDA • proof-of-value first • local control • training • ongoing support • no permanent Zenastra software fee','HOW WE START','NDA → demonstrate results → confirm scope → payment → install, train and support.'),('Trust, verification and evidence.','CIN: U62090WB2025PTC280868','GSTIN: 19AACCZ6798B1ZT','DPIIT: DIPP213909','DPDP-aligned local-control approach','Reported outcomes: Cotton Jersey (~₹80 lakh savings opportunity reported), The Love Band global growth support, Labels by Preeti Anand international growth, Ikris Pharma cost and outreach support.')]
c=canvas.Canvas(str(out),pagesize=(W,H))
for i,d in enumerate(slides):
 c.setFillColor(navy if i==0 else colors.HexColor('#F4F9FC')); c.rect(0,0,W,H,fill=1,stroke=0); c.setFillColor(white if i==0 else navy); c.setFont('Helvetica-Bold',27); c.drawString(42,H-58,d[0]); c.setFillColor(mint if i==0 else muted); c.setFont('Helvetica',15); c.drawString(42,H-85,d[1]); y=H-140; c.setFillColor(white if i==0 else ink); c.setFont('Helvetica-Bold',20); c.drawString(42,y,d[2]); y-=42; c.setFont('Helvetica',14)
 for text in d[3:]:
  for line in text.split(' • '): c.drawString(58,y,'• '+line); y-=25
  y-=10
 if i==5:
  c.setFillColor(colors.HexColor('#0B6BCB')); c.setFont('Helvetica-Bold',12); c.drawString(42,96,'VERIFICATION DETAILS PROVIDED FOR DILIGENCE'); c.setFillColor(muted); c.setFont('Helvetica',10); c.drawString(42,78,'Certificates and supporting documents can be shared during the NDA and diligence process.')
 c.setFillColor(muted if i else mint); c.setFont('Helvetica',9); c.drawString(42,24,'contact@zenastraindustries.com  •  +91 93308 60396  •  zenastraindustries.com'); c.showPage()
c.save()
print(out)