// src/tally/xml-builder.ts
// XML builders for every TallyPrime request type

export class XmlBuilder {
  // ── Standard XML Export (Report) ──────────────────────────────
  static buildExportRequest(
    reportName: string,
    staticVars: Record<string, string> = {}
  ): string {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>${this.esc(reportName)}</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${this.buildStaticVars(staticVars)}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  // ── Collection Export ─────────────────────────────────────────
  static buildCollectionExportRequest(
    collectionName: string,
    staticVars: Record<string, string> = {}
  ): string {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>${this.esc(collectionName)}</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${this.buildStaticVars(staticVars)}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  // ── Inline TDL Collection Query ───────────────────────────────
  static buildInlineTdlCollectionRequest(
    collectionName: string,
    tdlMessage: string,
    staticVars: Record<string, string> = {}
  ): string {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>${this.esc(collectionName)}</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${this.buildStaticVars(staticVars)}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          ${tdlMessage}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  // ── Object Export ─────────────────────────────────────────────
  static buildObjectExportRequest(
    subtype: string,
    id: string,
    fetchFields: string[] = [],
    staticVars: Record<string, string> = {}
  ): string {
    const fetchList = fetchFields.length > 0
      ? `<FETCHLIST>${fetchFields.map(f => `\n        <FETCH>${this.esc(f)}</FETCH>`).join('')}\n      </FETCHLIST>`
      : '';
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Object</TYPE>
    <SUBTYPE>${this.esc(subtype)}</SUBTYPE>
    <ID>${this.esc(id)}</ID>
  </HEADER>
  <BODY>
    <DESC>
      ${fetchList}
      <STATICVARIABLES>
        ${this.buildStaticVars(staticVars)}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  // ── Function Evaluation ───────────────────────────────────────
  static buildFunctionRequest(
    functionId: string,
    tdlMessage: string,
    params: string[] = []
  ): string {
    const paramList = params.length > 0
      ? `<FUNCPARAMLIST>${params.map(p => `\n        <PARAM>${this.esc(p)}</PARAM>`).join('')}\n      </FUNCPARAMLIST>`
      : '';
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Function</TYPE>
    <ID>$$${this.esc(functionId)}</ID>
  </HEADER>
  <BODY>
    <DESC>
      ${paramList}
      <TDL>
        <TDLMESSAGE>
          ${tdlMessage}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  // ── Import Data (Masters) ─────────────────────────────────────
  static buildMasterImportRequest(
    masterXml: string,
    company?: string
  ): string {
    const companyVar = company
      ? `<SVCURRENTCOMPANY>${this.esc(company)}</SVCURRENTCOMPANY>`
      : '';
    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          ${companyVar}
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${masterXml}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  // ── Import Data (Vouchers) ────────────────────────────────────
  static buildVoucherImportRequest(
    voucherXml: string,
    company?: string
  ): string {
    const companyVar = company
      ? `<SVCURRENTCOMPANY>${this.esc(company)}</SVCURRENTCOMPANY>`
      : '';
    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          ${companyVar}
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${voucherXml}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  // ── TDL Action Execution ──────────────────────────────────────
  static buildActionRequest(actionId: string): string {
    return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Execute</TALLYREQUEST>
    <TYPE>TDLAction</TYPE>
    <ID>${this.esc(actionId)}</ID>
  </HEADER>
  <BODY><DESC></DESC></BODY>
</ENVELOPE>`;
  }

  // ── Helpers ───────────────────────────────────────────────────
  static buildStaticVars(vars: Record<string, string>): string {
    return Object.entries(vars)
      .map(([k, v]) => `<${k}>${this.esc(v)}</${k}>`)
      .join('\n        ');
  }

  static esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ── Ledger XML ────────────────────────────────────────────────
  static buildLedgerXml(params: {
    name: string;
    parent?: string;
    action?: string;
    opening_balance?: string | number;
    gstin?: string;
    gst_registration_type?: string;
    address?: string;
    state?: string;
    pincode?: string;
    mobile?: string;
    email?: string;
    pan?: string;
    is_bill_by_bill?: boolean;
    credit_limit?: number;
    credit_days?: number;
    credit_period?: number;
    new_name?: string;
  }): string {
    const action = params.action || 'Create';
    let xml = `<LEDGER NAME="${this.esc(params.name)}" Action="${action}">`;
    if (params.new_name) xml += `\n    <NAME.LIST><NAME>${this.esc(params.new_name)}</NAME></NAME.LIST>`;
    xml += `\n    <NAME>${this.esc(params.new_name || params.name)}</NAME>`;
    if (params.parent) xml += `\n    <PARENT>${this.esc(params.parent)}</PARENT>`;
    if (params.opening_balance !== undefined && params.opening_balance !== null) xml += `\n    <OPENINGBALANCE>${this.esc(String(params.opening_balance))}</OPENINGBALANCE>`;
    if (params.address) xml += `\n    <ADDRESS.LIST><ADDRESS>${this.esc(params.address)}</ADDRESS></ADDRESS.LIST>`;
    if (params.pincode) xml += `\n    <PINCODE>${this.esc(params.pincode)}</PINCODE>`;
    if (params.mobile) xml += `\n    <LEDGERMOBILE>${this.esc(params.mobile)}</LEDGERMOBILE>`;
    if (params.email) xml += `\n    <EMAIL>${this.esc(params.email)}</EMAIL>`;
    if (params.pan) xml += `\n    <INCOMETAXNUMBER>${this.esc(params.pan)}</INCOMETAXNUMBER>`;
    if (params.is_bill_by_bill !== undefined) xml += `\n    <ISBILLWISEON>${params.is_bill_by_bill ? 'Yes' : 'No'}</ISBILLWISEON>`;
    if (params.credit_limit) xml += `\n    <CREDITLIMIT>${params.credit_limit}</CREDITLIMIT>`;
    const creditDays = params.credit_days || params.credit_period;
    if (creditDays) xml += `\n    <CREDITDAYS>${creditDays}</CREDITDAYS>`;
    if (params.gstin) {
      xml += `\n    <LEDGERGSTREGISTRATIONDETAILS.LIST>
      <APPLICABLEFROM>20170701</APPLICABLEFROM>
      <GSTIN>${this.esc(params.gstin)}</GSTIN>
      <GSTREGISTRATIONTYPE>${this.esc(params.gst_registration_type || 'Regular')}</GSTREGISTRATIONTYPE>
      ${params.state ? `<PLACEOFSUPPLY>${this.esc(params.state)}</PLACEOFSUPPLY>` : ''}
    </LEDGERGSTREGISTRATIONDETAILS.LIST>`;
    }
    xml += `\n  </LEDGER>`;
    return xml;
  }

  // ── Delete Master XML ─────────────────────────────────────────
  static buildDeleteMasterXml(type: string, name: string): string {
    return `<${type.toUpperCase()} NAME="${this.esc(name)}" Action="Delete"><NAME>${this.esc(name)}</NAME></${type.toUpperCase()}>`;
  }

  // ── Group XML ─────────────────────────────────────────────────
  static buildGroupXml(params: {
    name: string;
    parent: string;
    action?: string;
    new_name?: string;
    is_subledger?: boolean;
    affects_gross_profit?: boolean;
  }): string {
    const action = params.action || 'Create';
    let xml = `<GROUP NAME="${this.esc(params.name)}" Action="${action}">`;
    xml += `\n    <NAME>${this.esc(params.new_name || params.name)}</NAME>`;
    xml += `\n    <PARENT>${this.esc(params.parent)}</PARENT>`;
    if (params.is_subledger !== undefined) xml += `\n    <ISSUBLEDGER>${params.is_subledger ? 'Yes' : 'No'}</ISSUBLEDGER>`;
    if (params.affects_gross_profit !== undefined) xml += `\n    <AFFECTSGROSSPROFIT>${params.affects_gross_profit ? 'Yes' : 'No'}</AFFECTSGROSSPROFIT>`;
    xml += `\n  </GROUP>`;
    return xml;
  }

  // ── Stock Item XML ────────────────────────────────────────────
  static buildStockItemXml(params: {
    name: string;
    unit: string;
    action?: string;
    under?: string;
    parent?: string;
    category?: string;
    new_name?: string;
    gst_rate?: number;
    hsn_code?: string;
    opening_qty?: number;
    opening_rate?: number;
    opening_value?: number;
    opening_godown?: string;
    mrp?: number;
    is_batch_wise?: boolean;
    is_expiry_applicable?: boolean;
  }): string {
    const action = params.action || 'Create';
    const parentGroup = params.under || params.parent;
    let xml = `<STOCKITEM NAME="${this.esc(params.name)}" Action="${action}">`;
    xml += `\n    <NAME>${this.esc(params.new_name || params.name)}</NAME>`;
    if (parentGroup) xml += `\n    <PARENT>${this.esc(parentGroup)}</PARENT>`;
    if (params.category) xml += `\n    <CATEGORY>${this.esc(params.category)}</CATEGORY>`;
    if (params.unit) xml += `\n    <BASEUNITS>${this.esc(params.unit)}</BASEUNITS>`;
    if (params.is_batch_wise !== undefined) xml += `\n    <ISBATCHWISEON>${params.is_batch_wise ? 'Yes' : 'No'}</ISBATCHWISEON>`;
    if (params.is_expiry_applicable !== undefined) xml += `\n    <HASEXPIRYDATE>${params.is_expiry_applicable ? 'Yes' : 'No'}</HASEXPIRYDATE>`;
    if (params.hsn_code) xml += `\n    <HSNCODE>${this.esc(params.hsn_code)}</HSNCODE>`;
    if (params.gst_rate !== undefined) {
      xml += `\n    <GSTDETAILS.LIST>
      <APPLICABLEFROM>20170701</APPLICABLEFROM>
      <HSNCODE>${this.esc(params.hsn_code || '')}</HSNCODE>
      <TAXABILITY>Taxable</TAXABILITY>
      <GSTTYPEOFSUPPLY>Goods</GSTTYPEOFSUPPLY>
      <STATEWISEDETAILS.LIST>
        <RATEDETAILS.LIST>
          <GSTRATEDUTYHEAD>Central Tax</GSTRATEDUTYHEAD>
          <GSTRATE>${params.gst_rate / 2}</GSTRATE>
        </RATEDETAILS.LIST>
        <RATEDETAILS.LIST>
          <GSTRATEDUTYHEAD>State Tax</GSTRATEDUTYHEAD>
          <GSTRATE>${params.gst_rate / 2}</GSTRATE>
        </RATEDETAILS.LIST>
        <RATEDETAILS.LIST>
          <GSTRATEDUTYHEAD>Integrated Tax</GSTRATEDUTYHEAD>
          <GSTRATE>${params.gst_rate}</GSTRATE>
        </RATEDETAILS.LIST>
      </STATEWISEDETAILS.LIST>
    </GSTDETAILS.LIST>`;
    }
    if (params.mrp) xml += `\n    <MRPDETAILS.LIST><MRPRATE>${params.mrp}</MRPRATE></MRPDETAILS.LIST>`;
    if (params.opening_qty && params.opening_rate) {
      xml += `\n    <OPENINGBALANCE>${params.opening_qty} ${this.esc(params.unit)}</OPENINGBALANCE>`;
      xml += `\n    <OPENINGRATE>${params.opening_rate}/${this.esc(params.unit)}</OPENINGRATE>`;
      xml += `\n    <OPENINGVALUE>${params.opening_qty * params.opening_rate}</OPENINGVALUE>`;
      if (params.opening_godown) {
        xml += `\n    <BATCHALLOCATIONS.LIST>
      <GODOWNNAME>${this.esc(params.opening_godown)}</GODOWNNAME>
      <OPENINGBALANCE>${params.opening_qty} ${this.esc(params.unit)}</OPENINGBALANCE>
      <OPENINGRATE>${params.opening_rate}/${this.esc(params.unit)}</OPENINGRATE>
      <OPENINGVALUE>${params.opening_qty * params.opening_rate}</OPENINGVALUE>
    </BATCHALLOCATIONS.LIST>`;
      }
    }
    xml += `\n  </STOCKITEM>`;
    return xml;
  }

  // ── Unit XML ──────────────────────────────────────────────────
  static buildUnitXml(params: {
    name: string;
    symbol?: string;
    formal_name?: string;
    is_simple?: boolean;
    decimal_places?: number;
  }): string {
    let xml = `<UNIT NAME="${this.esc(params.name)}" Action="Create">`;
    xml += `\n    <NAME>${this.esc(params.name)}</NAME>`;
    // Per official Tally docs: ISSIMPLEUNIT is required for simple units
    xml += `\n    <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>`;
    xml += `\n    <ORIGINALNAME>${this.esc(params.symbol || params.name)}</ORIGINALNAME>`;
    if (params.formal_name) xml += `\n    <FORMALNAME>${this.esc(params.formal_name)}</FORMALNAME>`;
    if (params.decimal_places !== undefined) xml += `\n    <DECIMALPLACES>${params.decimal_places}</DECIMALPLACES>`;
    xml += `\n  </UNIT>`;
    return xml;
  }

  // ── Compound Unit XML ─────────────────────────────────────────
  static buildCompoundUnitXml(params: {
    name: string;
    first_unit: string;
    conversion: number;
    second_unit: string;
  }): string {
    return `<UNIT NAME="${this.esc(params.name)}" Action="Create">
    <NAME>${this.esc(params.name)}</NAME>
    <BASEUNITS>${this.esc(params.first_unit)}</BASEUNITS>
    <ADDITIONALUNITS>${this.esc(params.second_unit)}</ADDITIONALUNITS>
    <CONVERSION>${params.conversion}</CONVERSION>
    <ISSIMPLEUNIT>No</ISSIMPLEUNIT>
  </UNIT>`;
  }

  // ── Godown XML ────────────────────────────────────────────────
  static buildGodownXml(params: {
    name: string;
    under?: string;
    address?: string;
    allow_storage?: boolean;
  }): string {
    let xml = `<GODOWN NAME="${this.esc(params.name)}" Action="Create">`;
    xml += `\n    <NAME>${this.esc(params.name)}</NAME>`;
    if (params.under) xml += `\n    <PARENT>${this.esc(params.under)}</PARENT>`;
    if (params.address) xml += `\n    <ADDRESS.LIST><ADDRESS>${this.esc(params.address)}</ADDRESS></ADDRESS.LIST>`;
    if (params.allow_storage !== undefined) xml += `\n    <HASNOSPACE>${params.allow_storage ? 'No' : 'Yes'}</HASNOSPACE>`;
    xml += `\n  </GODOWN>`;
    return xml;
  }

  // ── Cost Centre XML ───────────────────────────────────────────
  static buildCostCentreXml(params: {
    name: string;
    under?: string;
  }): string {
    let xml = `<COSTCENTRE NAME="${this.esc(params.name)}" Action="Create">`;
    xml += `\n    <NAME>${this.esc(params.name)}</NAME>`;
    if (params.under) xml += `\n    <PARENT>${this.esc(params.under)}</PARENT>`;
    xml += `\n  </COSTCENTRE>`;
    return xml;
  }

  // ── Cost Category XML ─────────────────────────────────────────
  static buildCostCategoryXml(params: {
    name: string;
    allocate_revenue?: boolean;
    allocate_non_revenue?: boolean;
  }): string {
    let xml = `<COSTCATEGORY NAME="${this.esc(params.name)}" Action="Create">`;
    xml += `\n    <NAME>${this.esc(params.name)}</NAME>`;
    if (params.allocate_revenue !== undefined) xml += `\n    <ALLOCATEREVENUE>${params.allocate_revenue ? 'Yes' : 'No'}</ALLOCATEREVENUE>`;
    if (params.allocate_non_revenue !== undefined) xml += `\n    <ALLOCATENONREVENUE>${params.allocate_non_revenue ? 'Yes' : 'No'}</ALLOCATENONREVENUE>`;
    xml += `\n  </COSTCATEGORY>`;
    return xml;
  }

  // ── Voucher Type XML ──────────────────────────────────────────
  static buildVoucherTypeXml(params: {
    name: string;
    base_type: string;
    is_active?: boolean;
    default_narration?: string;
  }): string {
    let xml = `<VOUCHERTYPE NAME="${this.esc(params.name)}" Action="Create">`;
    xml += `\n    <NAME>${this.esc(params.name)}</NAME>`;
    xml += `\n    <PARENT>${this.esc(params.base_type)}</PARENT>`;
    if (params.is_active !== undefined) xml += `\n    <ISACTIVE>${params.is_active ? 'Yes' : 'No'}</ISACTIVE>`;
    if (params.default_narration) xml += `\n    <NARRATION>${this.esc(params.default_narration)}</NARRATION>`;
    xml += `\n  </VOUCHERTYPE>`;
    return xml;
  }

  // ── Currency XML ──────────────────────────────────────────────
  static buildCurrencyXml(params: {
    name: string;
    symbol: string;
    formal_name?: string;
    standard_rate?: number;
  }): string {
    let xml = `<CURRENCY NAME="${this.esc(params.name)}" Action="Create">`;
    xml += `\n    <NAME>${this.esc(params.name)}</NAME>`;
    xml += `\n    <MAILINGNAME>${this.esc(params.symbol)}</MAILINGNAME>`;
    if (params.formal_name) xml += `\n    <EXPANDEDSYMBOL>${this.esc(params.formal_name)}</EXPANDEDSYMBOL>`;
    if (params.standard_rate) xml += `\n    <DECIMALPLACES>2</DECIMALPLACES>`;
    xml += `\n  </CURRENCY>`;
    return xml;
  }

  // ── Stock Group XML ───────────────────────────────────────────
  static buildStockGroupXml(params: {
    name: string;
    under?: string;
    should_quantities_add?: boolean;
  }): string {
    let xml = `<STOCKGROUP NAME="${this.esc(params.name)}" Action="Create">`;
    xml += `\n    <NAME>${this.esc(params.name)}</NAME>`;
    if (params.under) xml += `\n    <PARENT>${this.esc(params.under)}</PARENT>`;
    if (params.should_quantities_add !== undefined) xml += `\n    <ISADDABLE>${params.should_quantities_add ? 'Yes' : 'No'}</ISADDABLE>`;
    xml += `\n  </STOCKGROUP>`;
    return xml;
  }

  // ── Stock Category XML ────────────────────────────────────────
  static buildStockCategoryXml(params: {
    name: string;
    under?: string;
  }): string {
    let xml = `<STOCKCATEGORY NAME="${this.esc(params.name)}" Action="Create">`;
    xml += `\n    <NAME>${this.esc(params.name)}</NAME>`;
    if (params.under) xml += `\n    <PARENT>${this.esc(params.under)}</PARENT>`;
    xml += `\n  </STOCKCATEGORY>`;
    return xml;
  }

  // ── Price Level XML ───────────────────────────────────────────
  static buildPriceLevelXml(name: string): string {
    return `<PRICELEVEL NAME="${this.esc(name)}" Action="Create">
    <NAME>${this.esc(name)}</NAME>
  </PRICELEVEL>`;
  }

  // ── Employee XML ──────────────────────────────────────────────
  static buildEmployeeXml(params: {
    name: string;
    action?: string;
    employee_group?: string;
    date_of_joining?: string;
    designation?: string;
    department?: string;
    function?: string;
    location?: string;
    pan?: string;
    aadhaar?: string;
    aadhar?: string;
    bank_account?: string;
    bank_ifsc?: string;
    ifsc?: string;
    pf_number?: string;
    uan?: string;
    esi_number?: string;
    new_name?: string;
    gender?: string;
    date_of_birth?: string;
    blood_group?: string;
    father_name?: string;
    date_of_leaving?: string;
    salary_details?: Array<{
      pay_head: string;
      amount?: number;
      percentage?: number;
      effective_from?: string;
    }>;
  }): string {
    const action = params.action || 'Create';
    let xml = `<EMPLOYEE NAME="${this.esc(params.name)}" Action="${action}">`;
    xml += `\n    <NAME>${this.esc(params.new_name || params.name)}</NAME>`;
    if (params.employee_group) xml += `\n    <PARENT>${this.esc(params.employee_group)}</PARENT>`;
    if (params.date_of_joining) xml += `\n    <DATEOFJOINING>${params.date_of_joining}</DATEOFJOINING>`;
    if (params.date_of_leaving) xml += `\n    <DATEOFRELEASE>${params.date_of_leaving}</DATEOFRELEASE>`;
    if (params.designation) xml += `\n    <DESIGNATION>${this.esc(params.designation)}</DESIGNATION>`;
    if (params.department) xml += `\n    <DEPARTMENT>${this.esc(params.department)}</DEPARTMENT>`;
    if (params.function) xml += `\n    <FUNCTION>${this.esc(params.function)}</FUNCTION>`;
    if (params.location) xml += `\n    <LOCATION>${this.esc(params.location)}</LOCATION>`;
    if (params.gender) xml += `\n    <GENDER>${this.esc(params.gender)}</GENDER>`;
    if (params.date_of_birth) xml += `\n    <DATEOFBIRTH>${params.date_of_birth}</DATEOFBIRTH>`;
    if (params.blood_group) xml += `\n    <BLOODGROUP>${this.esc(params.blood_group)}</BLOODGROUP>`;
    if (params.father_name) xml += `\n    <FATHERNAME>${this.esc(params.father_name)}</FATHERNAME>`;
    if (params.pan) xml += `\n    <INCOMETAXNUMBER>${this.esc(params.pan)}</INCOMETAXNUMBER>`;
    const aadhaarVal = params.aadhaar || params.aadhar;
    if (aadhaarVal) xml += `\n    <AABORUIDNO>${this.esc(aadhaarVal)}</AABORUIDNO>`;
    if (params.pf_number) xml += `\n    <PFACCOUNTNUMBER>${this.esc(params.pf_number)}</PFACCOUNTNUMBER>`;
    if (params.uan) xml += `\n    <UNIVERSALACCOUNTNUMBER>${this.esc(params.uan)}</UNIVERSALACCOUNTNUMBER>`;
    if (params.esi_number) xml += `\n    <ESINUMBER>${this.esc(params.esi_number)}</ESINUMBER>`;
    if (params.bank_account) xml += `\n    <BANKACCOUNTNUMBER>${this.esc(params.bank_account)}</BANKACCOUNTNUMBER>`;
    const ifscVal = params.ifsc || params.bank_ifsc;
    if (ifscVal) xml += `\n    <IFSCODE>${this.esc(ifscVal)}</IFSCODE>`;
    if (params.salary_details) {
      for (const sd of params.salary_details) {
        xml += `\n    <PAYROLLDETAILS.LIST>`;
        xml += `\n      <PAYHEAD>${this.esc(sd.pay_head)}</PAYHEAD>`;
        if (sd.amount !== undefined) xml += `\n      <AMOUNT>${sd.amount}</AMOUNT>`;
        if (sd.percentage !== undefined) xml += `\n      <PERCENTAGE>${sd.percentage}</PERCENTAGE>`;
        if (sd.effective_from) xml += `\n      <EFFECTIVEFROM>${sd.effective_from}</EFFECTIVEFROM>`;
        xml += `\n    </PAYROLLDETAILS.LIST>`;
      }
    }
    xml += `\n  </EMPLOYEE>`;
    return xml;
  }

  // ── Voucher XML Builder ───────────────────────────────────────
  static buildVoucherXml(params: {
    voucher_type: string;
    date: string;
    action?: string;
    voucher_number?: string;
    narration?: string;
    party_ledger?: string;
    is_invoice?: boolean;
    is_inventory_on?: boolean;
    place_of_supply?: string;
    ref_number?: string;
    cost_centre?: string;
    order_number?: string;
    due_date?: string;
    original_invoice_no?: string;
    cheque_number?: string;
    cheque_date?: string;
    reversal_date?: string;
    bank_date?: string;
    ledger_entries?: Array<{
      ledger_name: string;
      is_deemed_positive?: boolean;
      amount: number;
      bill_allocations?: Array<{ name: string; type: string; amount: number }>;
      cost_centre_allocations?: Array<{ name: string; amount: number }>;
    }>;
    inventory_entries?: Array<{
      stock_item_name: string;
      is_deemed_positive?: boolean;
      rate: number;
      unit: string;
      qty: number;
      amount: number;
      discount?: number;
      godown?: string;
      batch_name?: string;
      expiry_date?: string;
      accounting_ledger?: string; // Sales/Purchase ledger for ACCOUNTINGALLOCATIONS
    }>;
    payroll_entries?: Array<{
      employee_name: string;
      pay_head_name?: string;
      is_deemed_positive?: boolean;
      amount?: number;
    }>;
    attendance_entries?: Array<{
      attendance_type: string;
      units?: number;
      employee_name?: string;
      value?: number;
    }>;
  }): string {
    const action = params.action || 'Create';
    let xml = `<VOUCHER VCHTYPE="${this.esc(params.voucher_type)}" Action="${action}">`;
    xml += `\n    <DATE>${params.date}</DATE>`;
    xml += `\n    <VOUCHERTYPENAME>${this.esc(params.voucher_type)}</VOUCHERTYPENAME>`;
    if (params.voucher_number) xml += `\n    <VOUCHERNUMBER>${this.esc(params.voucher_number)}</VOUCHERNUMBER>`;

    // Per official Tally docs: PERSISTEDVIEW and OBJVIEW control how Tally
    // renders the voucher. Invoice mode vs Accounting mode changes the
    // expected entry structure.
    if (params.is_invoice && params.inventory_entries?.length) {
      xml += `\n    <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>`;
      xml += `\n    <OBJVIEW>Invoice Voucher View</OBJVIEW>`;
    } else {
      xml += `\n    <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>`;
    }

    if (params.narration) xml += `\n    <NARRATION>${this.esc(params.narration)}</NARRATION>`;
    if (params.party_ledger) xml += `\n    <PARTYLEDGERNAME>${this.esc(params.party_ledger)}</PARTYLEDGERNAME>`;
    if (params.is_invoice) xml += `\n    <ISINVOICE>Yes</ISINVOICE>`;
    if (params.is_inventory_on) xml += `\n    <ISINVENTORYON>Yes</ISINVENTORYON>`;
    if (params.place_of_supply) xml += `\n    <PLACEOFSUPPLY>${this.esc(params.place_of_supply)}</PLACEOFSUPPLY>`;
    if (params.ref_number) xml += `\n    <REFERENCE>${this.esc(params.ref_number)}</REFERENCE>`;
    if (params.order_number) xml += `\n    <ORDERNUMBER>${this.esc(params.order_number)}</ORDERNUMBER>`;
    if (params.due_date) xml += `\n    <EFFECTIVEDATE>${params.due_date}</EFFECTIVEDATE>`;
    if (params.original_invoice_no) xml += `\n    <ORIGINALINVOICENO>${this.esc(params.original_invoice_no)}</ORIGINALINVOICENO>`;
    if (params.cheque_number) xml += `\n    <INSTRUMENTNUMBER>${this.esc(params.cheque_number)}</INSTRUMENTNUMBER>`;
    if (params.cheque_date) xml += `\n    <INSTRUMENTDATE>${params.cheque_date}</INSTRUMENTDATE>`;
    if (params.bank_date) xml += `\n    <BANKDATE>${params.bank_date}</BANKDATE>`;
    if (params.reversal_date) xml += `\n    <ISOPTIONAL>Yes</ISOPTIONAL>\n    <EFFECTIVEDATE>${params.reversal_date}</EFFECTIVEDATE>`;

    // Ledger entries
    if (params.ledger_entries) {
      for (let i = 0; i < params.ledger_entries.length; i++) {
        const entry = params.ledger_entries[i];
        xml += `\n    <ALLLEDGERENTRIES.LIST>`;
        xml += `\n      <LEDGERNAME>${this.esc(entry.ledger_name)}</LEDGERNAME>`;
        const isDeemedPositive = entry.is_deemed_positive ?? (entry.amount >= 0);
        xml += `\n      <ISDEEMEDPOSITIVE>${isDeemedPositive ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>`;
        // Per official Tally XML samples: mark the party ledger entry
        if (params.party_ledger && entry.ledger_name === params.party_ledger) {
          xml += `\n      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>`;
          xml += `\n      <ISLASTDEEMEDPOSITIVE>${isDeemedPositive ? 'Yes' : 'No'}</ISLASTDEEMEDPOSITIVE>`;
        }
        xml += `\n      <AMOUNT>${entry.amount}</AMOUNT>`;
        if (entry.bill_allocations) {
          for (const bill of entry.bill_allocations) {
            xml += `\n      <BILLALLOCATIONS.LIST>`;
            xml += `\n        <NAME>${this.esc(bill.name)}</NAME>`;
            xml += `\n        <BILLTYPE>${this.esc(bill.type)}</BILLTYPE>`;
            xml += `\n        <AMOUNT>${bill.amount}</AMOUNT>`;
            xml += `\n      </BILLALLOCATIONS.LIST>`;
          }
        }
        if (entry.cost_centre_allocations) {
          for (const cc of entry.cost_centre_allocations) {
            xml += `\n      <COSTCENTREALLOCATIONS.LIST>`;
            xml += `\n        <NAME>${this.esc(cc.name)}</NAME>`;
            xml += `\n        <AMOUNT>${cc.amount}</AMOUNT>`;
            xml += `\n      </COSTCENTREALLOCATIONS.LIST>`;
          }
        }
        xml += `\n    </ALLLEDGERENTRIES.LIST>`;
      }
    }

    // Inventory entries
    if (params.inventory_entries) {
      for (const inv of params.inventory_entries) {
        xml += `\n    <ALLINVENTORYENTRIES.LIST>`;
        xml += `\n      <STOCKITEMNAME>${this.esc(inv.stock_item_name)}</STOCKITEMNAME>`;
        xml += `\n      <ISDEEMEDPOSITIVE>${(inv.is_deemed_positive ?? true) ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>`;
        xml += `\n      <RATE>${inv.rate}/${this.esc(inv.unit)}</RATE>`;
        xml += `\n      <AMOUNT>${inv.amount}</AMOUNT>`;
        xml += `\n      <ACTUALQTY>${inv.qty} ${this.esc(inv.unit)}</ACTUALQTY>`;
        xml += `\n      <BILLEDQTY>${inv.qty} ${this.esc(inv.unit)}</BILLEDQTY>`;
        if (inv.discount) xml += `\n      <DISCOUNT>${inv.discount}</DISCOUNT>`;
        xml += `\n      <BATCHALLOCATIONS.LIST>`;
        xml += `\n        <GODOWNNAME>${this.esc(inv.godown || 'Main Location')}</GODOWNNAME>`;
        if (inv.batch_name) xml += `\n        <BATCHNAME>${this.esc(inv.batch_name)}</BATCHNAME>`;
        xml += `\n        <DESTINATIONGODOWNNAME>${this.esc(inv.godown || 'Main Location')}</DESTINATIONGODOWNNAME>`;
        xml += `\n        <ACTUALQTY>${inv.qty} ${this.esc(inv.unit)}</ACTUALQTY>`;
        xml += `\n        <BILLEDQTY>${inv.qty} ${this.esc(inv.unit)}</BILLEDQTY>`;
        xml += `\n        <AMOUNT>${inv.amount}</AMOUNT>`;
        if (inv.expiry_date) xml += `\n        <EXPIRYDATE>${inv.expiry_date}</EXPIRYDATE>`;
        xml += `\n      </BATCHALLOCATIONS.LIST>`;
        // Per official Tally docs: ACCOUNTINGALLOCATIONS.LIST maps
        // each inventory line to a sales/purchase ledger
        if (inv.accounting_ledger) {
          xml += `\n      <ACCOUNTINGALLOCATIONS.LIST>`;
          xml += `\n        <LEDGERNAME>${this.esc(inv.accounting_ledger)}</LEDGERNAME>`;
          xml += `\n        <ISDEEMEDPOSITIVE>${(inv.is_deemed_positive ?? true) ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>`;
          xml += `\n        <AMOUNT>${inv.amount}</AMOUNT>`;
          xml += `\n      </ACCOUNTINGALLOCATIONS.LIST>`;
        }
        xml += `\n    </ALLINVENTORYENTRIES.LIST>`;
      }
    }

    // Payroll entries
    if (params.payroll_entries) {
      for (const pe of params.payroll_entries) {
        xml += `\n    <PAYROLLLEDGERENTRIES.LIST>`;
        xml += `\n      <EMPLOYEENAME>${this.esc(pe.employee_name)}</EMPLOYEENAME>`;
        if (pe.pay_head_name) xml += `\n      <PAYHEADNAME>${this.esc(pe.pay_head_name)}</PAYHEADNAME>`;
        if (pe.is_deemed_positive !== undefined) xml += `\n      <ISDEEMEDPOSITIVE>${pe.is_deemed_positive ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>`;
        if (pe.amount !== undefined) xml += `\n      <AMOUNT>${pe.amount}</AMOUNT>`;
        xml += `\n    </PAYROLLLEDGERENTRIES.LIST>`;
      }
    }

    // Attendance entries
    if (params.attendance_entries) {
      for (const ae of params.attendance_entries) {
        xml += `\n    <ATTENDANCEENTRIES.LIST>`;
        xml += `\n      <ATTENDANCETYPE>${this.esc(ae.attendance_type)}</ATTENDANCETYPE>`;
        xml += `\n      <UNITS>${ae.units ?? ae.value ?? 0}</UNITS>`;
        if (ae.employee_name) xml += `\n      <EMPLOYEENAME>${this.esc(ae.employee_name)}</EMPLOYEENAME>`;
        xml += `\n    </ATTENDANCEENTRIES.LIST>`;
      }
    }

    xml += `\n  </VOUCHER>`;
    return xml;
  }

  // ── BOM XML ───────────────────────────────────────────────────
  static buildBomXml(params: {
    finished_item?: string;
    stock_item_name?: string;
    components: Array<{ item_name: string; qty: number; unit: string; godown?: string }>;
    yield_qty?: number;
    output_qty?: number;
    output_unit?: string;
    action?: string;
    by_products?: Array<{ item_name: string; qty: number; unit: string }>;
  }): string {
    const itemName = params.finished_item || params.stock_item_name || '';
    const action = params.action || 'Alter';
    let xml = `<STOCKITEM NAME="${this.esc(itemName)}" Action="${action}">`;
    xml += `\n    <NAME>${this.esc(itemName)}</NAME>`;
    xml += `\n    <ISBOMITEM>Yes</ISBOMITEM>`;
    for (const comp of params.components) {
      xml += `\n    <BOMDETAILS.LIST>`;
      xml += `\n      <STOCKITEMNAME>${this.esc(comp.item_name)}</STOCKITEMNAME>`;
      xml += `\n      <BOMQTY>${comp.qty} ${this.esc(comp.unit)}</BOMQTY>`;
      xml += `\n    </BOMDETAILS.LIST>`;
    }
    xml += `\n  </STOCKITEM>`;
    return xml;
  }

  // ── Budget XML ────────────────────────────────────────────────
  static buildBudgetXml(params: {
    name: string;
    from_date?: string;
    to_date?: string;
    under?: string;
    budget_for?: string;
    action?: string;
    allocations?: Array<{ name: string; amount: number; period_from?: string; period_to?: string }>;
  }): string {
    const action = params.action || 'Create';
    let xml = `<BUDGET NAME="${this.esc(params.name)}" Action="${action}">`;
    xml += `\n    <NAME>${this.esc(params.name)}</NAME>`;
    if (params.from_date) xml += `\n    <FROMDATE>${params.from_date}</FROMDATE>`;
    if (params.to_date) xml += `\n    <TODATE>${params.to_date}</TODATE>`;
    if (params.under) xml += `\n    <PARENT>${this.esc(params.under)}</PARENT>`;
    if (params.budget_for) xml += `\n    <BUDGETFOR>${this.esc(params.budget_for)}</BUDGETFOR>`;
    if (params.allocations) {
      for (const alloc of params.allocations) {
        xml += `\n    <BUDGETALLOCATIONS.LIST>`;
        xml += `\n      <NAME>${this.esc(alloc.name)}</NAME>`;
        xml += `\n      <AMOUNT>${alloc.amount}</AMOUNT>`;
        if (alloc.period_from) xml += `\n      <FROMDATE>${alloc.period_from}</FROMDATE>`;
        if (alloc.period_to) xml += `\n      <TODATE>${alloc.period_to}</TODATE>`;
        xml += `\n    </BUDGETALLOCATIONS.LIST>`;
      }
    }
    xml += `\n  </BUDGET>`;
    return xml;
  }

  // ── Pay Head XML ──────────────────────────────────────────────
  static buildPayHeadXml(params: {
    name: string;
    type?: string;
    pay_type?: string;
    calculation_type?: string;
    base_pay_head?: string;
    rate?: number;
    income_type?: string;
    computation_formula?: string;
    under?: string;
    affect_net_salary?: boolean;
  }): string {
    const payType = params.type || params.pay_type || 'Earnings';
    const calcType = params.calculation_type || 'As Computed Value';
    let xml = `<PAYHEAD NAME="${this.esc(params.name)}" Action="Create">`;
    xml += `\n    <NAME>${this.esc(params.name)}</NAME>`;
    xml += `\n    <PAYTYPE>${this.esc(payType)}</PAYTYPE>`;
    xml += `\n    <CALCULATIONTYPE>${this.esc(calcType)}</CALCULATIONTYPE>`;
    if (params.base_pay_head) xml += `\n    <COMPUTEDON>${this.esc(params.base_pay_head)}</COMPUTEDON>`;
    if (params.computation_formula) xml += `\n    <COMPUTATIONFORMULA>${this.esc(params.computation_formula)}</COMPUTATIONFORMULA>`;
    else if (params.rate !== undefined) xml += `\n    <COMPUTATIONFORMULA>${params.rate}</COMPUTATIONFORMULA>`;
    if (params.under) xml += `\n    <PARENT>${this.esc(params.under)}</PARENT>`;
    if (params.income_type) xml += `\n    <INCOMETYPE>${this.esc(params.income_type)}</INCOMETYPE>`;
    if (params.affect_net_salary !== undefined) xml += `\n    <AFFECTNETSALARY>${params.affect_net_salary ? 'Yes' : 'No'}</AFFECTNETSALARY>`;
    xml += `\n  </PAYHEAD>`;
    return xml;
  }

  // ── Employee Group XML ────────────────────────────────────────
  static buildEmployeeGroupXml(params: {
    name: string;
    under?: string;
  }): string {
    let xml = `<EMPLOYEEGROUP NAME="${this.esc(params.name)}" Action="Create">`;
    xml += `\n    <NAME>${this.esc(params.name)}</NAME>`;
    if (params.under) xml += `\n    <PARENT>${this.esc(params.under)}</PARENT>`;
    xml += `\n  </EMPLOYEEGROUP>`;
    return xml;
  }

  // ── User XML ──────────────────────────────────────────────────
  static buildUserXml(params: {
    name: string;
    password?: string;
    security_level?: string;
    action?: string;
    new_name?: string;
    allow_remote_access?: boolean;
  }): string {
    const action = params.action || 'Create';
    let xml = `<USER NAME="${this.esc(params.name)}" Action="${action}">`;
    xml += `\n    <NAME>${this.esc(params.new_name || params.name)}</NAME>`;
    if (params.security_level) xml += `\n    <SECURITYLEVEL>${this.esc(params.security_level)}</SECURITYLEVEL>`;
    if (params.password) xml += `\n    <USERSECURITYPASSWORD>${this.esc(params.password)}</USERSECURITYPASSWORD>`;
    if (params.allow_remote_access !== undefined) xml += `\n    <ALLOWREMOTEACCESS>${params.allow_remote_access ? 'Yes' : 'No'}</ALLOWREMOTEACCESS>`;
    xml += `\n  </USER>`;
    return xml;
  }

  // ── Company XML ───────────────────────────────────────────────
  static buildCompanyXml(params: {
    name: string;
    financial_year_from?: string;
    books_beginning_from?: string;
    currency?: string;
    country?: string;
    gstin?: string;
    action?: string;
    address?: string;
    state_name?: string;
    pincode?: string;
    phone?: string;
    email?: string;
    website?: string;
    pan?: string;
    enable_gst?: boolean;
    enable_tds?: boolean;
    enable_payroll?: boolean;
    enable_inventory?: boolean;
  }): string {
    const action = params.action || 'Create';
    let xml = `<COMPANY NAME="${this.esc(params.name)}" Action="${action}">`;
    xml += `\n    <NAME>${this.esc(params.name)}</NAME>`;
    if (params.financial_year_from) xml += `\n    <STARTINGFROM>${params.financial_year_from}</STARTINGFROM>`;
    if (params.books_beginning_from) xml += `\n    <BOOKSFROM>${params.books_beginning_from}</BOOKSFROM>`;
    if (params.currency) xml += `\n    <BASECURRENCYNAME>${this.esc(params.currency)}</BASECURRENCYNAME>`;
    if (params.country) xml += `\n    <COUNTRYOFRESIDENCE>${this.esc(params.country)}</COUNTRYOFRESIDENCE>`;
    if (params.gstin) xml += `\n    <GSTREGISTRATIONNO>${this.esc(params.gstin)}</GSTREGISTRATIONNO>`;
    if (params.address) xml += `\n    <ADDRESS.LIST><ADDRESS>${this.esc(params.address)}</ADDRESS></ADDRESS.LIST>`;
    if (params.state_name) xml += `\n    <STATENAME>${this.esc(params.state_name)}</STATENAME>`;
    if (params.pincode) xml += `\n    <PINCODE>${this.esc(params.pincode)}</PINCODE>`;
    if (params.phone) xml += `\n    <PHONENUMBER>${this.esc(params.phone)}</PHONENUMBER>`;
    if (params.email) xml += `\n    <EMAIL>${this.esc(params.email)}</EMAIL>`;
    if (params.website) xml += `\n    <WEBSITE>${this.esc(params.website)}</WEBSITE>`;
    if (params.pan) xml += `\n    <INCOMETAXNUMBER>${this.esc(params.pan)}</INCOMETAXNUMBER>`;
    xml += `\n  </COMPANY>`;
    return xml;
  }
}
