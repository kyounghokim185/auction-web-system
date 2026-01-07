-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Properties Table
create table properties (
  id uuid primary key default uuid_generate_v4(),
  case_number text not null,
  address text not null,
  area numeric, -- Area in square meters or pyung
  min_bid_price bigint,
  market_value bigint,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Remodeling Tasks Table (Standard Unit Prices)
create table remodeling_tasks (
  id uuid primary key default uuid_generate_v4(),
  category text not null, -- e.g., 'Wallpaper', 'Flooring', 'Demolition'
  item_name text not null,
  unit text not null, -- e.g., 'm2', 'pyung', 'ea'
  unit_price bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Simulations Table (ROI Calculations)
create table simulations (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id) on delete cascade not null,
  total_remodeling_cost bigint not null,
  expected_sell_price bigint not null, -- Added field for ROI calc
  auction_bid_price bigint not null,   -- Added field for ROI calc
  acquisition_tax bigint not null,     -- Added field for ROI calc
  expected_roi numeric generated always as (
    case when (auction_bid_price + total_remodeling_cost) = 0 then 0
    else (
      (expected_sell_price - (auction_bid_price + total_remodeling_cost + acquisition_tax))::numeric 
      / (auction_bid_price + total_remodeling_cost)::numeric
    ) * 100
    end
  ) stored,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create simple RLS policies (optional but recommended)
alter table properties enable row level security;
alter table remodeling_tasks enable row level security;
alter table simulations enable row level security;

create policy "Enable read access for all users" on properties for select using (true);
create policy "Enable read access for all users" on remodeling_tasks for select using (true);
create policy "Enable read access for all users" on simulations for select using (true);
