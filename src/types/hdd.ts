export type HddBoyut = '2.5"' | '3.5"'

export type HddDurum = 'stokta' | 'satildi'

export interface Hdd {
  id: string
  serialNumber: string
  boyut: HddBoyut
  depolama: string
  stokGirisTarihi: string
  durum: HddDurum
  satilanKisi?: string
  satisTarihi?: string
  notlar?: string
}

export const BOYUT_SECENEKLERI: HddBoyut[] = ['2.5"', '3.5"']

export const DEPOLAMA_SECENEKLERI = [
  '160GB',
  '250GB',
  '320GB',
  '500GB',
  '640GB',
  '750GB',
  '1TB',
  '2TB',
  '3TB',
  '4TB',
  '6TB',
  '8TB',
  '10TB',
  '12TB',
  '14TB',
  '16TB',
  '18TB',
  '20TB',
] as const
