create table collection_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  set_code text not null,
  collector_number text not null,
  image_url text not null,
  created_at timestamptz not null default now()
);

create table decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table deck_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  collection_card_id uuid not null references collection_cards(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_collection_cards_user on collection_cards(user_id);
create index idx_decks_user on decks(user_id);
create index idx_deck_cards_deck on deck_cards(deck_id);

-- RLS
alter table collection_cards enable row level security;
alter table decks enable row level security;
alter table deck_cards enable row level security;

create policy "Users see own collection" on collection_cards for all using (auth.uid() = user_id);
create policy "Users manage own decks" on decks for all using (auth.uid() = user_id);
create policy "Users manage cards in own decks" on deck_cards for all
  using (deck_id in (select id from decks where user_id = auth.uid()));
