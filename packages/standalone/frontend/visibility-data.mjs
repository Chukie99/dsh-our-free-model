export function visibilityCopy(locale) {
  return String(locale).toLowerCase().startsWith('en') ? {
    hideFree: 'Hide anonymous and Kilo free models',
    hideEac: 'Hide EAC models',
    hide: 'Hide model',
    show: 'Show model',
    hidden: 'Hidden by preference',
    groupHidden: 'Turn off group hiding first',
    saved: 'Model visibility saved',
  } : {
    hideFree: 'Sembunyikan model gratis anonim dan Kilo',
    hideEac: 'Sembunyikan model EAC',
    hide: 'Sembunyikan model',
    show: 'Tampilkan model',
    hidden: 'Disembunyikan sesuai preferensi',
    groupHidden: 'Matikan penyembunyian grup terlebih dahulu',
    saved: 'Visibilitas model disimpan',
  }
}
