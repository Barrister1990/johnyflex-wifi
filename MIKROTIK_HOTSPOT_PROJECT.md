# EduMate Network
# MikroTik Hotspot Billing System
## Complete Project Specification

# Overview

We are building a commercial Wi-Fi Hotspot Billing System that works with Starlink and MikroTik routers.

The objective is to allow customers to connect to an open Wi-Fi network, automatically redirect them to our captive portal, pay for internet access using Mobile Money, and instantly receive internet access after successful payment.

The system must be scalable and support hotels, hostels, schools, cafés, churches, campuses, neighborhoods, and internet service providers.

This system should be enterprise-grade and production-ready.

---

# Hardware Architecture

## Phase 1 — Local lab (now): MikroTik = controller + Wi‑Fi

No separate access point yet. Customers connect **directly to the MikroTik**.

```text
Internet (MTN Turbonet / modem)
    ↓
MikroTik WAN
    ↓
MikroTik wifi1 (SSID)  ← customers join here
    ↓
Hotspot + captive portal → WiFiHub (laptop + ngrok)
```

See **[LOCAL_MIKROTIK_SETUP.md](./LOCAL_MIKROTIK_SETUP.md)** for the full local + ngrok checklist.

## Phase 2 — Production: MikroTik + Access Point(s)

```text
Internet
    ↓
Starlink Dish
    ↓
Starlink Router
    ↓
MikroTik Router   ← controller only (Hotspot / API)
    ↓
Access Point(s)   ← customers join AP SSID only
    ↓
Customers
```

The MikroTik is the central controller.

Access Points only broadcast Wi-Fi.

Customers never connect directly to MikroTik.

They connect to the Access Point.

The MikroTik handles:

- Authentication
- Hotspot
- User management
- Bandwidth control
- Session management
- Captive portal
- API communication

---

# Technology Stack

Frontend

- Next.js 15
- React
- TypeScript
- Tailwind CSS
- Shadcn UI

Backend

- Next.js API Routes

Database

- Supabase PostgreSQL

Authentication

- Supabase Auth

Payments

Initially

Mock Payments

Later

MTN MoMo
Telecel Cash
AirtelTigo Cash
Paystack

Router Communication

MikroTik API

Deployment

Development

localhost

Production

VPS

---

# Development Process

Everything should be built and tested locally before deploying to a VPS.

Development workflow:

Laptop

↓

Next.js

↓

Supabase

↓

MikroTik API

↓

MikroTik Router

↓

Phone Testing

The system should not require cloud hosting during development.

---

# Customer Workflow

Customer sees Wi-Fi

EduMate WiFi

↓

Customer connects

No password required

↓

Customer opens any website

↓

MikroTik automatically redirects

↓

Captive Portal opens

↓

Customer selects package

↓

Customer pays

↓

Backend verifies payment

↓

Backend calls MikroTik API

↓

MikroTik grants access

↓

Customer browses internet

---

# Subscription Packages

Examples

1 Hour

3 Hours

24 Hours

7 Days

30 Days

Unlimited

Administrator should be able to create unlimited custom plans.

Each package should support

Price

Time

Bandwidth

Upload Speed

Download Speed

Data Limit

Expiry

---

# Customer Information

Every customer should have

ID

Name

Phone Number

MAC Address

IP Address

Device Name

Purchase History

Current Plan

Expiry Time

Status

Location

Total Payments

---

# MikroTik Responsibilities

The router should

Authenticate users

Redirect users

Grant internet

Block internet

Disconnect expired users

Apply speed limits

Keep active sessions

Store hotspot users

Manage queues

Manage profiles

Everything else should happen inside our application.

---

# Backend Responsibilities

The backend should

Manage payments

Manage subscriptions

Call MikroTik API

Store customer data

Store transactions

Generate reports

Handle webhooks

Handle receipts

Generate invoices

Manage packages

---

# MikroTik API Integration

The application should connect to MikroTik using

Host

Port

Username

Password

Use API SSL whenever possible.

Supported actions

Create hotspot user

Update hotspot user

Delete hotspot user

Enable user

Disable user

Disconnect active user

List active users

Read interfaces

Read queues

Read hotspot profiles

Read active sessions

Create queues

Update queues

Delete queues

Everything should be abstracted into a MikroTik service.

---

# Supabase Tables

customers

subscriptions

payments

packages

routers

hotspots

transactions

devices

active_sessions

audit_logs

admins

settings

notifications

---

# Dashboard

Administrator dashboard

Should display

Today's Revenue

Monthly Revenue

Online Users

Offline Users

Active Plans

Expired Plans

Routers Online

Access Points

Bandwidth Usage

Payment Statistics

New Customers

Recent Transactions

Graphs

Charts

Realtime updates

---

# Router Management

Administrator should be able to

Add Router

Remove Router

Edit Router

Connect Router

Test Connection

Restart Router

Backup Router

Restore Router

Monitor Router

Each router stores

Name

Host

Username

Password

Port

Location

Status

Version

Model

---

# Access Point Management

Although APs are simple bridge devices, the dashboard should allow

Register AP

Assign Router

Location

Signal

Status

Notes

Future monitoring support

---

# Hotspot Profiles

Admin should create profiles

Basic

Premium

VIP

Unlimited

Each profile supports

Upload speed

Download speed

Session timeout

Idle timeout

Shared users

Data quota

---

# Captive Portal

The portal should contain

Logo

Brand Colors

Packages

Payment Button

Terms

Support

Phone Number

Login

Voucher Login

Purchase History

Remaining Time

Logout

Responsive Design

Dark Mode

Animations

---

# Payment Flow

Customer clicks package

↓

Backend creates transaction

↓

Customer pays

↓

Payment gateway callback

↓

Verify payment

↓

Store payment

↓

Create MikroTik user

↓

Grant internet

↓

Return success

---

# Customer Dashboard

Customer can

See active plan

Buy plan

Extend plan

View payment history

See connected devices

Logout devices

View expiry

Generate receipt

---

# Admin Features

Customer management

Package management

Router management

Access Point management

Revenue

Reports

Refunds

Coupons

Voucher generation

Promo codes

Notifications

Logs

Audit trail

System settings

---

# Security

Never expose MikroTik API publicly.

Production should use VPN between VPS and MikroTik.

Passwords encrypted.

HTTPS only.

Rate limiting.

Audit logs.

Role-based permissions.

JWT authentication.

Secure cookies.

CSRF protection.

Input validation.

---

# User Roles

Super Admin

Admin

Manager

Cashier

Support

Viewer

Each role should have different permissions.

---

# Future Features

SMS

Email receipts

WhatsApp receipts

QR login

Voucher printing

Radius support

Multiple MikroTik routers

Load balancing

Failover

ISP mode

Bandwidth analytics

Customer loyalty

Referral system

Mobile App

Offline synchronization

Cloud monitoring

AI analytics

---

# UI Design

Modern SaaS Dashboard

Glassmorphism

Rounded corners

Professional

Enterprise

Fast

Responsive

Beautiful animations

Dark mode

Light mode

No generic AI layouts

Clean typography

Professional charts

---

# Development Order

Phase 1

Supabase

Authentication

Dashboard

Packages

Customers

Phase 2

MikroTik API

Router connection

Create users

Delete users

Update users

Phase 3

Hotspot

Captive Portal

Login

Redirect

Session Management

Phase 4

Payments

Webhook

Verification

Grant Internet

Phase 5

Reports

Analytics

Notifications

Receipts

Phase 6

Deployment

Docker

VPS

Monitoring

Backups

---

# Final Goal

The final system should function like commercial hotspot platforms used by hotels, universities, airports, internet cafés, and wireless ISPs.

A customer should simply:

Connect to Wi-Fi

↓

See captive portal

↓

Pay

↓

Receive internet immediately

Everything else should happen automatically.

The application should be modular, scalable, enterprise-grade, maintainable, secure, and ready to support thousands of concurrent users and multiple MikroTik routers from a single dashboard.