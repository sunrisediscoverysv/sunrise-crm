-- Seed del catálogo con las propiedades publicadas en sunrisediscovery.com/properties
-- Idempotente: re-ejecutar no duplica (on conflict por slug).
insert into properties (name, slug, location, property_type, price_label, price_usd, size_label, source_url) values
  ('Prime Land – Puerto La Libertad', 'puerto-la-libertad', 'Santa Tecla, La Libertad, El Salvador', 'land', '$100/v²', null, '18,000 v²', 'https://sunrisediscovery.com/properties/puerto-la-libertad'),
  ('Ocean-View Development Land – El Zonte', 'ocean-view-development-land---el-zonte', 'La Libertad, El Salvador', 'land', '$65/v²', null, '11,000 v²', 'https://sunrisediscovery.com/properties/ocean-view-development-land---el-zonte'),
  ('Oceanfront Land', 'oceanfront-land', 'La Libertad, El Salvador', 'land', '$420,000', 420000, '1,100 v²', 'https://sunrisediscovery.com/properties/oceanfront-land'),
  ('Ocean View Land', 'ocean-view-land', 'La Libertad, El Salvador', 'land', '$15/v²', null, '30,000 v²', 'https://sunrisediscovery.com/properties/ocean-view-land'),
  ('Lakefront Land', 'lakefront-land', 'Coatepeque Lake, El Salvador', 'land', '$335,000', 335000, '3,171.84 v²', 'https://sunrisediscovery.com/properties/lakefront-land'),
  ('Land in Juayúa', 'land-in-juayua', 'Juayúa, Sonsonate, El Salvador', 'land', '$75,000', 75000, '2,440 v²', 'https://sunrisediscovery.com/properties/land-in-juayua'),
  ('Land Near Airport', 'land-near-airport', 'Amatecampo, El Salvador', 'land', '$2,400,000', 2400000, '600,000 v²', 'https://sunrisediscovery.com/properties/land-near-airport'),
  ('Land on Claudia Lars Highway', 'land-on-claudia-lars-highway', 'Claudia Lars Highway, El Salvador', 'land', '$300,000', 300000, '80,000 v²', 'https://sunrisediscovery.com/properties/land-on-claudia-lars-highway'),
  ('Land on San Salvador', 'land-on-san-salvador', 'Claudia Lars Highway, El Salvador', 'land', '$475,000', 475000, '5,115 v²', 'https://sunrisediscovery.com/properties/land-on-san-salvador'),
  ('Land in El Sunzal', 'land-in-el-sunzal', 'El Sunzal, Surf City, El Salvador', 'land', '$158,000', 158000, '1,100 v²', 'https://sunrisediscovery.com/properties/land-in-el-sunzal'),
  ('Land in San Blas', 'land-in-san-blas', 'El Sunzal, Surf City, El Salvador', 'land', '$205,000', 205000, '500 v²', 'https://sunrisediscovery.com/properties/land-in-san-blas'),
  ('Ocean View Land – Surf City', 'ocean-view-land-2', 'Surf City, La Libertad, El Salvador', 'land', '$185,000', 185000, '5,029 v²', 'https://sunrisediscovery.com/properties/ocean-view-land-2'),
  ('Nuevo Cuscatlán Residencial', 'nuevo-cuscatlan-residencial', 'Nuevo Cuscatlán, La Libertad, El Salvador', 'land', '$125,000', 125000, '974 v²', 'https://sunrisediscovery.com/properties/nuevo-cuscatlan-residencial'),
  ('Ocean View Lots Near El Zonte', 'ocean-view-lots-near-el-zonte', 'Near El Zonte, La Libertad, El Salvador', 'lot', '$55,000', 55000, '974 v²', 'https://sunrisediscovery.com/properties/ocean-view-lots-near-el-zonte')
on conflict (slug) do nothing;
