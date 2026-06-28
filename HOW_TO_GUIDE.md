# Cooperative Management System — How-To Guide

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [User Roles](#2-user-roles)
3. [Registration & Login](#3-registration--login)
4. [Members Module](#4-members-module)
5. [Transactions (Posting Ledger)](#5-transactions-posting-ledger)
6. [Loan Applications](#6-loan-applications)
7. [Reports & Audits](#7-reports--audits)
8. [User Accounts](#8-user-accounts)
9. [Member Portal (Self-Service)](#9-member-portal-self-service)
10. [My Profile](#10-my-profile)
11. [Settings](#11-settings)

---

## 1. Getting Started

When the system is first set up, the **first person to register becomes the System Admin** automatically. All other users must register and wait for admin approval before they can log in.

---

## 2. User Roles

| Role | What They Can Do |
|---|---|
| **System Admin** | Full access — configure system, manage users, post transactions, approve loans |
| **Manager** | Manage users, create members, post transactions, approve loans, view reports |
| **Accounting Officer** | Create members, post transactions (including manual adjustments), approve loans |
| **Cashier** | Create members, post transactions, review deposit requests |
| **Auditor** | View-only access to reports and audit logs |
| **Member** | Self-service only — view own balances, request deposits, apply for loans |

---

## 3. Registration & Login

### Self-Registration (Members & Staff)

1. Open the app and click **"New employee? Register here"**
2. Enter your **Employee ID** — this verifies your identity against the roster
3. Enter your **email** and a **password** (minimum 6 characters)
4. Click **Register Account**
5. Check your inbox and confirm your email
6. Wait for a System Admin to approve your account

> Your account shows as **Pending Approval** until an admin activates it.

### Logging In

1. Enter your email and password
2. Click **Authenticate**

### Forgot Password

1. On the login screen, click **"Forgot password?"**
2. Enter your registered email
3. Click **Send Reset Link**
4. Check your inbox and click the link
5. Enter and confirm your new password

### Staff Accounts (Admin-Created)

If an admin created your account directly, you will receive an email with a **temporary password**. Log in with it — you will be prompted to set a new password before you can continue.

---

## 4. Members Module

> **Who can use this:** System Admin, Manager, Accounting Officer, Cashier

### Viewing Members

- The members list shows all registered cooperative members
- Use the **search bar** to find by name, employee ID, email, or department
- Click any member row to open their **detail panel** on the right (desktop) or below (mobile)

### Member Detail Panel

Clicking a member shows:
- **Biographical info** — name, department, email, phone
- **Account balances** — withdrawable savings and share capital
- **Subsidiary ledger** — full transaction history for that member

### Adding a New Member

1. Click **"+ New Member"**
2. Search for the user by email or name (they must already have an approved system account)
3. Their details auto-fill from the employee roster
4. Correct any fields as needed and click **Save**

### Editing a Member

1. Click the member row to open their detail panel
2. Click the **Edit** button
3. Update the fields and click **Save**

> Only System Admins can change a member's Employee ID.

### Suspending / Activating a Member

1. Open the member detail panel
2. Click the **Suspend** or **Activate** button
3. Confirm the action

---

## 5. Transactions (Posting Ledger)

> **Who can post:** System Admin, Manager, Accounting Officer, Cashier
> **Who can reverse:** System Admin, Manager, Accounting Officer

### Posting a Transaction

1. Go to **Posting Ledger**
2. Click **"+ Post Transaction"**
3. Select the **Member** (type to search)
4. Select the **Transaction Type:**
   - **Deposit** — adds to member savings
   - **Withdrawal** — deducts from member savings
   - **Share Capital Contribution** — adds to member equity
   - **Manual Adjustment** — custom debit/credit entry *(Accounting Officer and above only)*
5. Enter the **Amount** and an optional **Description**
6. Click **Post Transaction**

> All transactions are double-entry and create an immutable ledger record.

### Reversing a Transaction

1. Find the transaction in the list
2. Click the **Reverse** button on that row
3. Confirm the reversal

> A reversal creates an opposing journal entry — the original is never deleted.

### Reviewing Deposit Requests

Members can submit deposit requests from their portal. Staff can review them under the **Deposit Requests** tab:

1. Click the **Deposit Requests** tab
2. Review the submitted amount and receipt
3. Click **Approve** (posts to ledger automatically) or **Reject** (with a reason)

### Exporting the Ledger

- Click the **Download** button to export as CSV
- Click the **Printer** button to generate a PDF via the browser print dialog

---

## 6. Loan Applications

> **Who can review:** System Admin, Manager, Accounting Officer

### Viewing Applications

- Go to **Loan Applications**
- Filter by status: **All | Pending | Approved | Rejected | Cancelled**
- Click the **expand arrow** on any row to see full details including purpose, estimated monthly payment, and previous review notes

### Approving a Loan

1. Find a **Pending** application
2. Click **Approve**
3. Add optional notes and confirm

### Rejecting a Loan

1. Find a **Pending** application
2. Click **Reject**
3. Enter a reason (required) and confirm

---

## 7. Reports & Audits

> **Who can access:** System Admin, Manager, Accounting Officer, Auditor, Cashier
> **Audit Log:** System Admin, Manager, Auditor only

### Trial Balance

Shows all Chart of Accounts entries with debit and credit totals.

- A **green banner** confirms the ledger is balanced
- A **red banner** indicates an imbalance and shows the difference
- Click **Download** to export as CSV

### Members Capital Map

Shows savings and share capital balances across all members:

- **Summary cards** at the top show total savings and total equity
- **Bar chart** visualizes distribution per member
- **Table** below is searchable and sortable — click column headers to sort

### Security Traces (Audit Log)

A chronological log of all significant system actions — approvals, reversals, role changes, account creation.

- Shows **date/time**, **action type**, **details**, and **who performed it**

---

## 8. User Accounts

> **Who can access:** System Admin only

### Viewing Users

- Go to **User Accounts**
- Search by name or email
- Filter by **Status** (All | Pending Approval | Active) or **Role**

### Approving a Pending User

Users who self-registered appear as **Pending Approval**.

**If they provided an Employee ID at registration:**
1. Click **Approve** — activates their account immediately

**If they did NOT provide an Employee ID:**
1. Click **Link & Approve**
2. Search and select the matching employee from the roster
3. Assign their role
4. Click **Approve & Activate**

> You can check **"Approve without Employee ID"** for owners or external stakeholders not in the roster.

### Creating a Staff Account (Admin Direct-Create)

1. Click **"+ Add Employee"**
2. Enter their full name, email, and role
3. Set a temporary password (or use the auto-generated one)
4. Click **Create Account**
5. A credentials email is sent to the employee automatically
6. On their first login, they are required to set a new password

### Changing a User's Role

Find the user in the list and use the **Role dropdown** to change their role.

### Suspending a User

Click the **Suspend** button next to an active user to revoke their login access. They can be reactivated the same way.

---

## 9. Member Portal (Self-Service)

> **Who can access:** Members only

The Member Portal is the member's personal dashboard showing their financial standing and allowing them to transact.

### Viewing Balances

The top of the portal shows:
- **Withdrawable Savings** — total savings balance
- **Membership Share Capital** — total equity contribution

### Viewing Your Ledger Statement

The **Account Statement** table shows every transaction on your account:
- Date, description, debit (withdrawals), credit (deposits)
- Reversed transactions appear with a strikethrough
- Click **Print** to generate a printable statement

### Requesting a Deposit

1. Click **"Request Deposit"**
2. Enter the amount
3. Upload a receipt (photo or file — JPG, PNG, or PDF)
4. Click **Submit**

Your request goes to the cashier/officer for review. Once approved, it posts to your account automatically.

### Applying for a Loan

1. Scroll to **Loan Applications**
2. Click **"Apply for a Loan"** (only available if you have no pending application)
3. Select a **Loan Product**
4. Enter the amount, term, and purpose
5. Click **Submit Application**

The estimated monthly payment is shown as you fill in the form.

### Cancelling a Loan Application

If your application is still **Pending**, you can cancel it:
1. Find it in your loan applications list
2. Click **Cancel** and confirm

---

## 10. My Profile

> **Who can access:** All users

### Updating Your Profile

1. Click your name or avatar in the sidebar
2. Navigate to **My Profile**
3. Edit your display name and phone number
4. Click **Save Changes**

> Members cannot change their own name — contact the System Admin.

### Changing Your Avatar

1. Go to **My Profile**
2. Hover over the avatar circle and click the camera icon
3. Select an image file (PNG, JPG, or SVG)

---

## 11. Settings

> **Who can access:** System Admin only

Settings is divided into sections:

| Section | What You Can Configure |
|---|---|
| **General** | App name, logo, subtitle, motto, mission, vision, contact info |
| **Membership Types** | Types of membership (Regular, Associate, etc.) |
| **Membership Statuses** | Active, Inactive, etc. |
| **Departments** | Department names and codes |
| **Share Capital** | Par value, minimum shares, monthly contribution rules |
| **Savings & Loan Products** | Interest rates, min/max amounts, terms |
| **Loan Approval Rules** | Which roles can approve up to what amount |
| **Chart of Accounts** | View and manage accounting codes |

Changes take effect immediately and are reflected across the entire system.

---

*For technical support or issues, contact your System Administrator.*
