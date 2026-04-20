# bicycle

| 物理名 | 必須 | index | データ型 | List | バリデーション | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| （税抜き）14日間プラン料金 |  |  | number |  |  |  |
| （税抜き）1日プラン料金 |  |  | number |  |  |  |
| （税抜き）2日間プラン料金 |  |  | number |  |  |  |
| （税抜き）30日間プラン料金 |  |  | number |  |  |  |
| （税抜き）3日間プラン料金 |  |  | number |  |  |  |
| （税抜き）4時間プラン料金 |  |  | number |  |  |  |
| （税抜き）7日間プラン料金 |  |  | number |  |  |  |
| （税抜き）延長1時間料金 |  |  |  |  |  |  |
| （税抜き）延長1日料金 |  |  | number |  |  |  |
| 14日間プラン料金 |  |  | number |  |  |  |
| 1日プラン料金 |  |  | number |  |  |  |
| 2日間プラン料金 |  |  | number |  |  |  |
| 30日間プラン料金 |  |  | number |  |  |  |
| 3日間プラン料金 |  |  | number |  |  |  |
| 4時間プラン料金 |  |  | number |  |  |  |
| 7日間プラン料金 |  |  | number |  |  |  |
| Bicycle Category |  |  | リレーション |  |  | Bicycle Category |
| brand_name |  |  | text |  |  |  |
| color |  |  | text |  |  |  |
| comment |  |  | text |  |  |  |
| ebike |  |  | boolean |  |  |  |
| four_weeks_price |  |  | number |  |  |  |
| images |  |  | image | ✓ |  |  |
| is_archive |  |  | boolean |  |  |  |
| max_date |  |  | number |  |  |  |
| more_a_day_price |  |  | number |  |  |  |
| more_a_hour_price |  |  | number |  |  |  |
| name | ✓ |  | text |  |  |  |
| no |  | ✓ | number |  |  |  |
| price_menu |  |  | リレーション |  |  | → price_menu |
| serial_number |  | ✓ | text |  |  |  |
| size |  |  | text |  |  |  |
| tax_percent |  |  | number |  |  |  |
| three_weeks_price |  |  | number |  |  |  |
| two_weeks_price |  |  | number |  |  |  |
| Shop | ✓ |  | リレーション |  |  | → user |
| 貸し出し可能ステータス |  |  | リレーション |  |  | 貸し出し可能ステータス |
