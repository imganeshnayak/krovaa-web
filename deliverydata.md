# ShipRocket Data Collection & API Integration Guide

**Marketplace Model**: Sellers fulfill orders to buyers via ShipRocket courier network.

---

## Table of Contents

1. [Seller Data Collection](#seller-data-collection)
2. [Buyer/Receiver Data Collection](#buyerreceiver-data-collection)
3. [Product/Order Data](#productorder-data)
4. [ShipRocket API Payload Mapping](#shiprocket-api-payload-mapping)
5. [Data Validation Rules](#data-validation-rules)
6. [Database Schema](#database-schema)
7. [API Request Examples](#api-request-examples)
8. [Error Handling](#error-handling)

---

## Seller Data Collection

### 1. One-Time Registration Data (Stored in `sellers` table)

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| `business_name` | string | ✅ | 3-100 chars, unique | "ABC Electronics Pvt Ltd" |
| `shop_name` | string | ✅ | 3-50 chars, unique | "Tech Paradise" |
| `email` | email | ✅ | Valid format, unique | "seller@techparadise.com" |
| `phone` | string | ✅ | 10-digit Indian mobile | "9876543210" |
| `gst_number` | string | ❌ | 15-char GSTIN format | "27AABCT1234H1Z0" |
| `business_type` | enum | ✅ | individual \| partnership \| company | "company" |
| `bank_account_holder` | string | ✅ | Account holder name | "ABC Electronics" |
| `bank_account_number` | string | ✅ | 9-18 digits | "12345678901234" |
| `bank_ifsc_code` | string | ✅ | 11-char IFSC | "HDFC0000123" |
| `profile_photo` | file | ❌ | JPG/PNG, <5MB | - |
| `created_at` | timestamp | ✅ | Auto | - |
| `is_verified` | boolean | ✅ | Default false | false |

**Validation Logic:**
```javascript
// Email uniqueness check
SELECT * FROM sellers WHERE email = ?

// Phone uniqueness check
SELECT * FROM sellers WHERE phone = ?

// GSTIN validation (optional, can use external API)
// Format: 2-digit state + PAN + entity type + registration
// Example: 27 (MH state) + AABCT1234H (PAN) + 1 (entity) + Z0 (check digits)

// Bank account validation (basic)
if (ifscCode.length !== 11) throw Error("Invalid IFSC");
if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) throw Error("Invalid IFSC format");
if (accountNumber.length < 9 || accountNumber.length > 18) throw Error("Invalid account number");
```

---

### 2. Warehouse/Pickup Location Data (Stored in `seller_warehouses` table)

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| `warehouse_id` | uuid | ✅ | Primary key | "warehouse_123" |
| `seller_id` | uuid | ✅ | Foreign key | "seller_456" |
| `warehouse_name` | string | ✅ | 3-50 chars | "Mumbai Main Warehouse" |
| `address_line_1` | string | ✅ | Street address | "123, Industrial Park" |
| `address_line_2` | string | ❌ | Optional | "Building A, Floor 3" |
| `city` | string | ✅ | City name | "Mumbai" |
| `state` | string | ✅ | 2-letter state code | "MH" |
| `country` | string | ✅ | Fixed "IN" | "IN" |
| `pincode` | string | ✅ | 6-digit | "400001" |
| `contact_person_name` | string | ✅ | Full name | "Rajesh Kumar" |
| `contact_person_phone` | string | ✅ | 10-digit mobile | "8765432109" |
| `pickup_time_slot` | enum | ✅ | 8AM-12PM \| 12PM-4PM \| 4PM-8PM | "8AM-12PM" |
| `sr_email` | string | ✅ | ShipRocket email (encrypted) | - |
| `sr_password` | string | ✅ | ShipRocket password (encrypted) | - |
| `sr_channel_id` | string | ✅ | From ShipRocket dashboard | "67890" |
| `sr_pickup_location_id` | string | ✅ | From ShipRocket API | "12345" |
| `is_verified` | boolean | ✅ | Warehouse verified by SR | false |
| `is_active` | boolean | ✅ | Seller can use this warehouse | true |

**Validation Logic:**
```javascript
// State code validation
const validStates = ['AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'CT', 
                     'DD', 'DL', 'DN', 'GA', 'GJ', 'HR', 'HP', 'JK', 
                     'JH', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN', 
                     'ME', 'MZ', 'NL', 'OD', 'PB', 'PY', 'RJ', 'SK', 
                     'TN', 'TR', 'TS', 'UP', 'UK', 'WB'];
if (!validStates.includes(state)) throw Error("Invalid state code");

// Pincode validation
if (!/^\d{6}$/.test(pincode)) throw Error("Pincode must be 6 digits");

// Phone validation
if (!/^[6-9]\d{9}$/.test(phone)) throw Error("Invalid phone number");

// ShipRocket credentials encryption
const encrypted_sr_password = encrypt(sr_password, ENCRYPTION_KEY);
```

**ShipRocket Verification Process:**
```
1. Seller submits warehouse
2. You validate address format & pincode with SR
3. Call ShipRocket API to get sr_pickup_location_id
4. Store sr_pickup_location_id in database
5. Mark is_verified = true
6. Seller can now create shipments from this warehouse
```

---

## Buyer/Receiver Data Collection

### Collected at Checkout (Stored in `order_addresses` table)

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| `address_id` | uuid | ✅ | Primary key | "addr_789" |
| `buyer_id` | uuid | ✅ | Foreign key | "buyer_123" |
| `order_id` | uuid | ❌ | FK (set during order creation) | "order_456" |
| `full_name` | string | ✅ | 3-100 chars, no special chars | "John Doe" |
| `phone_number` | string | ✅ | 10-digit Indian mobile | "9123456789" |
| `email` | email | ❌ | Valid email format | "john@example.com" |
| `address_type` | enum | ✅ | home \| work \| other | "home" |
| `address_line_1` | string | ✅ | Street address | "123 Main Street, Apt 5B" |
| `address_line_2` | string | ❌ | Building/landmark | "Near the park" |
| `landmark` | string | ❌ | Courier reference | "Behind the temple" |
| `city` | string | ✅ | City name | "Mumbai" |
| `state` | string | ✅ | 2-letter state code | "MH" |
| `country` | string | ✅ | Fixed "IN" | "IN" |
| `pincode` | string | ✅ | 6-digit | "400072" |
| `is_default` | boolean | ✅ | Save for future | true |
| `is_billing_same` | boolean | ✅ | Same as billing address | true |

**Validation Logic:**
```javascript
// Phone validation - must be reachable
if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
  throw Error("Invalid Indian phone number");
}

// Pincode validation - must be 6 digits
if (!/^\d{6}$/.test(pincode)) {
  throw Error("Pincode must be 6 digits");
}

// Block PO Box addresses (couriers can't deliver)
const blockedKeywords = ['PO BOX', 'P.O BOX', 'P O BOX', 'POST BOX'];
if (blockedKeywords.some(keyword => addressLine1.toUpperCase().includes(keyword))) {
  throw Error("PO Box addresses are not supported");
}

// Pincode serviceability check (ShipRocket)
const isServiceable = await checkPincodeWithShipRocket(pincode);
if (!isServiceable) {
  throw Error("ShipRocket does not deliver to this pincode");
}

// Address completeness
if (addressLine1.length < 10) {
  throw Error("Please provide a complete street address");
}
```

---

## Product/Order Data

### Stored in `order_items` table

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| `order_item_id` | uuid | ✅ | Primary key | "item_001" |
| `order_id` | uuid | ✅ | Foreign key | "order_456" |
| `product_id` | uuid | ✅ | Foreign key | "prod_789" |
| `seller_id` | uuid | ✅ | Foreign key | "seller_456" |
| `product_name` | string | ✅ | 3-200 chars | "Samsung Galaxy S21" |
| `sku` | string | ✅ | Unique per seller | "SAM-S21-BLK-64GB" |
| `quantity` | integer | ✅ | 1-999 | 1 |
| `unit_price` | decimal | ✅ | > 0, max 2 decimals | 49999.00 |
| `hsn_code` | string | ❌ | For GST (8 digits) | "85176290" |

### Package Information (Per Shipment)

| Field | Type | Required | Validation | Example |
|-------|------|----------|-----------|---------|
| `weight_kg` | decimal | ✅ | > 0, max 2 decimals | 0.5 |
| `length_cm` | decimal | ✅ | > 0, max 2 decimals | 30 |
| `width_cm` | decimal | ✅ | > 0, max 2 decimals | 20 |
| `height_cm` | decimal | ✅ | > 0, max 2 decimals | 10 |

**Validation Logic:**
```javascript
// Weight validation - ShipRocket has limits
if (weightKg < 0.1 || weightKg > 50) {
  throw Error("Weight must be between 0.1 kg and 50 kg");
}

// Dimensions validation
if (lengthCm < 5 || lengthCm > 150) {
  throw Error("Length must be between 5 cm and 150 cm");
}
if (widthCm < 5 || widthCm > 150) {
  throw Error("Width must be between 5 cm and 150 cm");
}
if (heightCm < 5 || heightCm > 150) {
  throw Error("Height must be between 5 cm and 150 cm");
}

// Volume check (optional but recommended)
const volumeCm3 = lengthCm * widthCm * heightCm;
const maxVolume = 150 * 150 * 150; // 3.375 million cm³
if (volumeCm3 > maxVolume) {
  throw Error("Package dimensions exceed maximum volume");
}

// SKU uniqueness per seller
const existingSKU = await db.orderItems.findOne({
  seller_id: sellerId,
  sku: sku
});
if (existingSKU) {
  throw Error("SKU already exists for this seller");
}
```

---

## ShipRocket API Payload Mapping

### ShipRocket Create Shipment Request

```javascript
// POST https://apiv2.shiprocket.in/v1/external/orders/create/forward-shipment
// Authorization: Bearer {sr_token}

{
  // Order Identifiers (from your system)
  "order_id": "order_456",  // Your unique order ID
  "order_date": "2024-01-15",  // ISO format
  
  // Pickup Configuration (from seller warehouse)
  "pickup_location_id": 12345,  // sr_pickup_location_id stored in DB
  "channel_id": 67890,  // sr_channel_id from seller warehouse config
  
  // Receiver/Billing Information (from buyer address)
  "billing_customer_name": "John Doe",  // buyer.full_name
  "billing_email": "john@example.com",  // buyer.email
  "billing_phone": "9123456789",  // buyer.phone_number
  "billing_address": "123 Main Street, Apt 5B",  // buyer.address_line_1
  "billing_address_2": "Near the park",  // buyer.landmark (optional)
  "billing_city": "Mumbai",  // buyer.city
  "billing_state": "MH",  // buyer.state (2-letter code)
  "billing_country": "IN",  // Fixed
  "billing_pincode": "400072",  // buyer.pincode
  
  // Shipping Address (usually same as billing, but can differ)
  "shipping_customer_name": "John Doe",
  "shipping_email": "john@example.com",
  "shipping_phone": "9123456789",
  "shipping_address": "123 Main Street, Apt 5B",
  "shipping_address_2": "Near the park",
  "shipping_city": "Mumbai",
  "shipping_state": "MH",
  "shipping_country": "IN",
  "shipping_pincode": "400072",
  
  // Order Items
  "order_items": [
    {
      "name": "Samsung Galaxy S21",  // product_name
      "sku": "SAM-S21-BLK-64GB",  // sku
      "units": 1,  // quantity
      "selling_price": "49999.00",  // unit_price
      "hsn_code": "85176290"  // Optional, for GST
    }
  ],
  
  // Package Dimensions
  "weight": 0.5,  // weight_kg
  "length": 30,  // length_cm
  "breadth": 20,  // width_cm
  "height": 10,  // height_cm
  
  // Monetary Details
  "sub_total": 49999.00,  // Sum of all order_items
  "length": 30,
  "breadth": 20,
  "height": 10,
  "weight": 0.5,
  
  // Payment & Shipping Method
  "payment_method": "Prepaid",  // For marketplace: always "Prepaid"
  "shipping_charges": 0,  // Can be 0 or actual amount
  "giftwrap_charges": 0,
  "transaction_charges": 0,
  "total_discount": 0,
  "cod_amount": 0,  // Use if COD
  
  // Additional Info
  "is_return": false,  // Set to true for return shipments
  "reseller_name": "Your Platform Name",  // Optional
  "reseller_add": "Your Address",  // Optional
  "invoice_number": "INV-123",  // Optional invoice reference
  "customer_gstin": "",  // B2B: buyer's GSTIN
  "seller_gstin": "27AABCT1234H1Z0",  // seller.gst_number
  "seller_name": "ABC Electronics",  // seller.business_name
  "seller_add": "123 Industrial Park"  // seller warehouse address
}
```

### ShipRocket Response

```javascript
{
  "success": true,
  "code": 200,
  "message": "Shipment created successfully",
  "data": {
    "shipment_id": 567890,  // Store this in shipments table
    "order_id": "order_456",
    "awb_code": "FDX987654321",  // Tracking ID visible to buyer
    "courier_id": 1,  // Which courier was assigned
    "courier_name": "Fedex",
    "awb_assign_status": 1,  // 1 = assigned, 0 = pending
    "shipment_status": 0,  // 0 = pending pickup
    "order_status": "pending_pickup",
    "courier_partner_id": 1
  }
}
```

---

## Data Validation Rules

### Comprehensive Validation Checklist

#### Seller Data

```javascript
// 1. Business Name
- Length: 3-100 characters
- Cannot be empty or whitespace only
- Trim whitespace
- Validation regex: /^[a-zA-Z0-9\s\-.,&()]+$/
- Error: "Business name contains invalid characters"

// 2. Shop Name
- Length: 3-50 characters
- Unique in database
- Trim whitespace
- Error: "Shop name already exists"

// 3. Email
- Valid email format (use email-validator library)
- Lowercase before storing
- Unique in database
- Must be active/verified
- Error: "Email already registered"

// 4. Phone
- Exactly 10 digits
- Must start with 6-9 (Indian mobile)
- Unique in database
- Cannot have landline numbers
- Validation: /^[6-9]\d{9}$/
- Error: "Please enter a valid Indian mobile number"

// 5. GST Number (Optional)
- 15 characters if provided
- Format: 2-digit state + 10-digit PAN + entity type + check digit
- Can validate via official GSTIN API
- Validation: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

// 6. Bank Account
- IFSC: 11 characters, format ABCD0000000
- Account number: 9-18 digits
- Validation: /^[A-Z]{4}0[A-Z0-9]{6}$/ (IFSC)
```

#### Buyer/Receiver Data

```javascript
// 1. Full Name
- Length: 3-100 characters
- No special characters except spaces, hyphens, apostrophes
- Trim whitespace
- Validation: /^[a-zA-Z\s\-']+$/
- Error: "Name can only contain letters, spaces, hyphens, and apostrophes"

// 2. Phone Number
- Exactly 10 digits
- Must start with 6-9
- Must be reachable (attempt SMS verification)
- Validation: /^[6-9]\d{9}$/
- Error: "Invalid phone number"

// 3. Email (Optional)
- Valid email format if provided
- Validation: /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 4. Address Line 1
- Length: minimum 10 characters
- Cannot be only numbers
- Cannot contain PO Box
- Block keywords: ["PO", "P.O", "POST BOX"]
- Error: "PO Box addresses are not supported by couriers"

// 5. City
- Must be in ShipRocket serviceable cities list
- Case-insensitive matching
- Error: "ShipRocket does not deliver to this city"

// 6. State
- Must be valid 2-letter state code
- Validation: STATE_CODES.includes(state)
- Valid codes: AN, AP, AR, AS, BR, CG, CH, CT, DD, DL, DN, GA, GJ, HR, HP, JK, JH, KA, KL, LA, LD, MH, ML, MN, ME, MZ, NL, OD, PB, PY, RJ, SK, TN, TR, TS, UP, UK, WB

// 7. Pincode
- Must be 6 digits
- Must be serviceable by ShipRocket
- Call ShipRocket API: GET /postal-codes/{pincode}
- Validation: /^\d{6}$/
- Error: "Invalid pincode or ShipRocket doesn't deliver here"
```

#### Package Data

```javascript
// 1. Weight
- Must be > 0
- Max 50 kg (ShipRocket limit)
- Max 2 decimal places
- Validation: weightKg > 0 && weightKg <= 50
- Error: "Weight must be between 0.1 kg and 50 kg"

// 2. Dimensions (Length, Width, Height)
- Each must be 5-150 cm
- Max 2 decimal places
- Validation: 5 <= dimension <= 150
- Error: "Each dimension must be between 5 and 150 cm"

// 3. Volume Check (Optional)
- Total volume should not exceed reasonable limits
- Validation: (L × W × H) <= 3,375,000 cm³
- Warning: "Package seems unusually large, confirm dimensions"
```

---

## Database Schema

```sql
-- Sellers Table
CREATE TABLE sellers (
  seller_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name VARCHAR(100) NOT NULL UNIQUE,
  shop_name VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(10) NOT NULL UNIQUE,
  gst_number VARCHAR(15),
  bank_account_holder VARCHAR(100) NOT NULL,
  bank_account_number VARCHAR(18) NOT NULL,
  bank_ifsc_code VARCHAR(11) NOT NULL,
  profile_photo_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seller Warehouses Table
CREATE TABLE seller_warehouses (
  warehouse_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(seller_id),
  warehouse_name VARCHAR(100) NOT NULL,
  address_line_1 VARCHAR(255) NOT NULL,
  address_line_2 VARCHAR(255),
  city VARCHAR(50) NOT NULL,
  state VARCHAR(2) NOT NULL,
  country VARCHAR(2) DEFAULT 'IN',
  pincode VARCHAR(6) NOT NULL,
  contact_person_name VARCHAR(100) NOT NULL,
  contact_person_phone VARCHAR(10) NOT NULL,
  pickup_time_slot VARCHAR(20) NOT NULL, -- "8AM-12PM", "12PM-4PM", "4PM-8PM"
  sr_email VARCHAR(255) NOT NULL,
  sr_password_encrypted VARCHAR(500) NOT NULL,
  sr_channel_id VARCHAR(20) NOT NULL,
  sr_pickup_location_id VARCHAR(20),
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seller_id, warehouse_id)
);

-- Orders Table
CREATE TABLE orders (
  order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(seller_id),
  buyer_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES seller_warehouses(warehouse_id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending → confirmed → packed → shipped → in_transit → delivered
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(20),
  payment_status VARCHAR(20) DEFAULT 'pending',
  shipping_address_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items Table
CREATE TABLE order_items (
  order_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(order_id),
  product_id UUID NOT NULL,
  seller_id UUID NOT NULL REFERENCES sellers(seller_id),
  product_name VARCHAR(200) NOT NULL,
  sku VARCHAR(50) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  hsn_code VARCHAR(8),
  UNIQUE(seller_id, sku)
);

-- Order Addresses Table
CREATE TABLE order_addresses (
  address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  order_id UUID REFERENCES orders(order_id),
  full_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(10) NOT NULL,
  email VARCHAR(255),
  address_type VARCHAR(20) NOT NULL DEFAULT 'home', -- home, work, other
  address_line_1 VARCHAR(255) NOT NULL,
  address_line_2 VARCHAR(255),
  landmark VARCHAR(200),
  city VARCHAR(50) NOT NULL,
  state VARCHAR(2) NOT NULL,
  country VARCHAR(2) DEFAULT 'IN',
  pincode VARCHAR(6) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_billing_same BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipments Table
CREATE TABLE shipments (
  shipment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(order_id),
  seller_id UUID NOT NULL REFERENCES sellers(seller_id),
  warehouse_id UUID NOT NULL REFERENCES seller_warehouses(warehouse_id),
  sr_shipment_id VARCHAR(20) NOT NULL, -- From ShipRocket response
  awb_code VARCHAR(50) NOT NULL UNIQUE, -- Tracking number visible to buyer
  tracking_id VARCHAR(50),
  courier_partner VARCHAR(50), -- Fedex, Delhivery, etc.
  status VARCHAR(50) NOT NULL DEFAULT 'pending_pickup',
  -- pending_pickup → picked_up → in_transit → out_for_delivery → delivered
  weight_kg DECIMAL(5, 2) NOT NULL,
  length_cm DECIMAL(5, 2) NOT NULL,
  width_cm DECIMAL(5, 2) NOT NULL,
  height_cm DECIMAL(5, 2) NOT NULL,
  pickup_requested_at TIMESTAMP,
  pickup_confirmed_at TIMESTAMP,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tracking Events Table
CREATE TABLE tracking_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(shipment_id),
  status VARCHAR(50) NOT NULL,
  location VARCHAR(200),
  description TEXT,
  event_timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Request Examples

### 1. Seller Registration

**Request:**
```bash
POST /api/sellers/register
Content-Type: application/json

{
  "business_name": "ABC Electronics Pvt Ltd",
  "shop_name": "Tech Paradise",
  "email": "seller@techparadise.com",
  "phone": "9876543210",
  "gst_number": "27AABCT1234H1Z0",
  "bank_account_holder": "ABC Electronics",
  "bank_account_number": "12345678901234",
  "bank_ifsc_code": "HDFC0000123"
}
```

**Response:**
```json
{
  "success": true,
  "seller_id": "seller_123",
  "message": "Seller registered successfully. Please add a warehouse."
}
```

### 2. Add Warehouse to Seller

**Request:**
```bash
POST /api/sellers/:seller_id/warehouses
Content-Type: application/json
Authorization: Bearer {seller_token}

{
  "warehouse_name": "Mumbai Main Warehouse",
  "address_line_1": "123, Industrial Park",
  "address_line_2": "Building A, Floor 3",
  "city": "Mumbai",
  "state": "MH",
  "pincode": "400001",
  "contact_person_name": "Rajesh Kumar",
  "contact_person_phone": "8765432109",
  "pickup_time_slot": "8AM-12PM",
  "sr_email": "seller_warehouse@shiprocket.com",
  "sr_password": "password123",
  "sr_channel_id": "67890"
}
```

**Response:**
```json
{
  "success": true,
  "warehouse_id": "warehouse_123",
  "sr_pickup_location_id": "12345",
  "message": "Warehouse added successfully"
}
```

### 3. Create Order (Buyer Side)

**Request:**
```bash
POST /api/orders
Content-Type: application/json
Authorization: Bearer {buyer_token}

{
  "seller_id": "seller_123",
  "warehouse_id": "warehouse_123",
  "items": [
    {
      "product_id": "prod_789",
      "quantity": 1
    }
  ],
  "shipping_address": {
    "full_name": "John Doe",
    "phone_number": "9123456789",
    "email": "john@example.com",
    "address_line_1": "123 Main Street, Apt 5B",
    "address_line_2": "Near the park",
    "landmark": "Behind the temple",
    "city": "Mumbai",
    "state": "MH",
    "pincode": "400072"
  }
}
```

**Response:**
```json
{
  "success": true,
  "order_id": "order_456",
  "total_amount": 49999.00,
  "status": "pending",
  "message": "Order created successfully"
}
```

### 4. Mark Order as Packed (Seller Side)

**Request:**
```bash
PUT /api/sellers/orders/:order_id/status
Content-Type: application/json
Authorization: Bearer {seller_token}

{
  "status": "packed",
  "weight_kg": 0.5,
  "length_cm": 30,
  "width_cm": 20,
  "height_cm": 10
}
```

**Response:**
```json
{
  "success": true,
  "order_id": "order_456",
  "status": "packed",
  "message": "Order marked as packed. Click 'Create Shipment' to proceed."
}
```

### 5. Create Shipment in ShipRocket

**Request:**
```bash
POST /api/sellers/shipments
Content-Type: application/json
Authorization: Bearer {seller_token}

{
  "order_id": "order_456"
}
```

**Backend Logic:**
```javascript
// 1. Fetch order details from database
const order = await db.orders.findById(orderId);
const orderItems = await db.orderItems.find({ order_id: orderId });
const shipment = await db.shipments.findOne({ order_id: orderId });
const address = await db.orderAddresses.findById(order.shipping_address_id);
const warehouse = await db.sellerWarehouses.findById(order.warehouse_id);

// 2. Get ShipRocket token
const srToken = await authenticateWithShipRocket(
  warehouse.sr_email,
  warehouse.sr_password
);

// 3. Build ShipRocket payload
const srPayload = {
  order_id: order.order_id,
  order_date: order.created_at.toISOString().split('T')[0],
  pickup_location_id: warehouse.sr_pickup_location_id,
  channel_id: warehouse.sr_channel_id,
  billing_customer_name: address.full_name,
  billing_email: address.email,
  billing_phone: address.phone_number,
  billing_address: address.address_line_1,
  billing_address_2: address.address_line_2,
  billing_city: address.city,
  billing_state: address.state,
  billing_country: "IN",
  billing_pincode: address.pincode,
  shipping_customer_name: address.full_name,
  shipping_email: address.email,
  shipping_phone: address.phone_number,
  shipping_address: address.address_line_1,
  shipping_address_2: address.address_line_2,
  shipping_city: address.city,
  shipping_state: address.state,
  shipping_country: "IN",
  shipping_pincode: address.pincode,
  order_items: orderItems.map(item => ({
    name: item.product_name,
    sku: item.sku,
    units: item.quantity,
    selling_price: item.unit_price.toString(),
    hsn_code: item.hsn_code || ""
  })),
  weight: shipment.weight_kg,
  length: shipment.length_cm,
  breadth: shipment.width_cm,
  height: shipment.height_cm,
  sub_total: orderItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0),
  payment_method: "Prepaid"
};

// 4. Call ShipRocket API
const response = await axios.post(
  'https://apiv2.shiprocket.in/v1/external/orders/create/forward-shipment',
  srPayload,
  { headers: { 'Authorization': `Bearer ${srToken}` } }
);

// 5. Save response to database
if (response.data.success) {
  await db.shipments.update(
    { order_id: orderId },
    {
      sr_shipment_id: response.data.data.shipment_id,
      awb_code: response.data.data.awb_code,
      courier_partner: response.data.data.courier_name,
      status: 'pending_pickup'
    }
  );
  
  await db.orders.update(
    { order_id: orderId },
    { status: 'shipped' }
  );
}
```

**Response:**
```json
{
  "success": true,
  "order_id": "order_456",
  "shipment_id": "shipment_567890",
  "awb_code": "FDX987654321",
  "courier_partner": "Fedex",
  "tracking_url": "https://tracking.shiprocket.in/FDX987654321",
  "message": "Shipment created successfully"
}
```

### 6. Track Shipment (Buyer Side)

**Request:**
```bash
GET /api/orders/:order_id/tracking
Authorization: Bearer {buyer_token}
```

**Response:**
```json
{
  "success": true,
  "order_id": "order_456",
  "awb_code": "FDX987654321",
  "courier": "Fedex",
  "status": "in_transit",
  "current_location": "Mumbai Hub",
  "last_update": "2024-01-16 14:30:00",
  "expected_delivery": "2024-01-18",
  "timeline": [
    {
      "status": "picked_up",
      "location": "Mumbai",
      "timestamp": "2024-01-16 08:00:00"
    },
    {
      "status": "in_transit",
      "location": "Mumbai Hub",
      "timestamp": "2024-01-16 14:30:00"
    }
  ]
}
```

---

## Error Handling

### ShipRocket API Errors

```javascript
// Common ShipRocket Error Responses

// 1. Pincode Not Serviceable
{
  "success": false,
  "code": 400,
  "message": "Pincode not serviceable"
}
// Handle: Show buyer "We don't deliver to this area, try another address"

// 2. Shipment Already Exists
{
  "success": false,
  "code": 409,
  "message": "Shipment already exists for this order"
}
// Handle: Check database if shipment already created, prevent duplicate

// 3. Invalid Credentials
{
  "success": false,
  "code": 401,
  "message": "Invalid authentication"
}
// Handle: Prompt seller to re-enter ShipRocket credentials

// 4. Rate Limit Exceeded
{
  "success": false,
  "code": 429,
  "message": "Too many requests"
}
// Handle: Implement exponential backoff, retry after 60 seconds

// 5. Invalid Address
{
  "success": false,
  "code": 400,
  "message": "Invalid billing address"
}
// Handle: Show seller which field is invalid, ask to update
```

### Custom Error Handling

```javascript
async function createShipmentWithRetry(orderId, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await createShipmentInShipRocket(orderId);
      if (response.success) {
        return response;
      }
    } catch (error) {
      lastError = error;
      
      if (error.code === 429) {
        // Rate limit: wait exponentially longer
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited. Retrying after ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else if (error.code === 401) {
        // Auth error: don't retry, prompt seller
        throw new Error("ShipRocket credentials invalid. Please update them in Settings.");
      } else if (error.code === 400) {
        // Validation error: don't retry, show details
        throw new Error(`Invalid address: ${error.message}`);
      } else {
        // Unknown error: retry with backoff
        const waitTime = attempt * 2000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // All retries failed
  throw new Error(`Failed to create shipment after ${maxRetries} attempts: ${lastError.message}`);
}
```

### Validation Error Messages

```javascript
const validationErrors = {
  INVALID_PHONE: "Please enter a valid 10-digit Indian mobile number",
  INVALID_PINCODE: "Pincode must be 6 digits",
  PINCODE_NOT_SERVICEABLE: "We don't deliver to this pincode. Please try another address.",
  INVALID_STATE_CODE: "Please select a valid state",
  PO_BOX_NOT_ALLOWED: "PO Box addresses are not accepted by our couriers",
  INVALID_ADDRESS: "Please provide a complete street address",
  DUPLICATE_EMAIL: "This email is already registered",
  DUPLICATE_PHONE: "This phone number is already registered",
  DUPLICATE_SHOP_NAME: "This shop name is already taken",
  INVALID_GSTIN: "Please enter a valid 15-character GSTIN",
  INVALID_IFSC: "Please enter a valid 11-character IFSC code",
  INVALID_WEIGHT: "Weight must be between 0.1 kg and 50 kg",
  INVALID_DIMENSIONS: "Each dimension must be between 5 and 150 cm",
  INVALID_SKU: "SKU already exists for this seller",
  SHIPMENT_ALREADY_EXISTS: "Shipment already created for this order",
  SR_CREDENTIALS_INVALID: "ShipRocket credentials are invalid. Please re-enter them."
};
```

---

## Summary Checklist

### Before Calling ShipRocket API
- [ ] Buyer pincode is serviceable (check via ShipRocket)
- [ ] All buyer address fields are filled and validated
- [ ] Product SKU is unique per seller
- [ ] Package weight is between 0.1 - 50 kg
- [ ] Package dimensions are between 5 - 150 cm each
- [ ] Seller has ShipRocket account configured
- [ ] Seller warehouse is verified with ShipRocket
- [ ] Order status is "confirmed" or "packed"
- [ ] ShipRocket token is fresh (< 24 hours)

### Data Mapping Quick Reference
| Your Field | ShipRocket Field | Example |
|-----------|------------------|---------|
| buyer.full_name | billing_customer_name | John Doe |
| buyer.phone | billing_phone | 9123456789 |
| buyer.address_line_1 | billing_address | 123 Main St |
| buyer.city | billing_city | Mumbai |
| buyer.state | billing_state | MH |
| buyer.pincode | billing_pincode | 400072 |
| product.name | order_items[].name | Samsung S21 |
| product.sku | order_items[].sku | SAM-S21-BLK |
| quantity | order_items[].units | 1 |
| unit_price | order_items[].selling_price | 49999.00 |
| shipment.weight_kg | weight | 0.5 |
| shipment.length_cm | length | 30 |
| shipment.width_cm | breadth | 20 |
| shipment.height_cm | height | 10 |

---

**Last Updated:** January 2024
**Version:** 1.0