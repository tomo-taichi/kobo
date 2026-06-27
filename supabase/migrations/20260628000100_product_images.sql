-- Product photos: 2 product-level hero photos (product_color_id null) + per-colour
-- galleries (product_color_id set). Each row stores a WebP web (2048px) + thumb (600px)
-- derivative; the original upload is discarded after processing.
create table if not exists public.product_images (
  id                uuid primary key default uuid_generate_v4(),
  product_id        uuid not null references public.products(id) on delete cascade,
  product_color_id  uuid references public.product_colors(id) on delete cascade,  -- null = main/hero photo
  web_path          text not null,
  thumb_path        text not null,
  web_url           text not null,
  thumb_url         text not null,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists product_images_product_id_idx on public.product_images (product_id);
create index if not exists product_images_product_color_id_idx on public.product_images (product_color_id);

create or replace trigger set_updated_at before update on public.product_images
  for each row execute function update_updated_at();

grant select, insert, update, delete on public.product_images to anon, authenticated;
alter table public.product_images enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_images' and policyname='authenticated full access') then
    execute 'create policy "authenticated full access" on public.product_images for all to authenticated using (true) with check (true)';
  end if;
end $$;

-- Storage bucket for product images (public read; processed WebP only)
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('product-images', 'product-images', true, array['image/webp'])
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='product_images_all') then
    execute 'create policy "product_images_all" on storage.objects for all to anon, authenticated using (bucket_id = ''product-images'') with check (bucket_id = ''product-images'')';
  end if;
end $$;
