#!/usr/bin/env bash
# Pulizia delle vecchie pubblicazioni di volley-lignano su Vercel (lo spazio «Deployment Storage» del piano gratuito).
# Restano le ultime due: volley-lignano-nqufktqkv-sog1t.vercel.app del 31/10 (quella online) e
# volley-lignano-51b6sikyt-sog1t.vercel.app del 30/10; quelle fatte dopo il 31/10/2026 non sono nell'elenco e restano anche loro.
# L'elenco è stato letto da Vercel il 31/10/2026: 199 pubblicazioni da togliere, dal 23/09 al 30/10.
# Toglie solo questi indirizzi, a gruppi di 10: non tocca il progetto, le variabili, i domini né il database.
#
# Uso (anche da iPad, in GitHub Codespaces): npx vercel login, poi bash scripts/vercel-pulizia.sh.
# Questo file non va in produzione: la cartella scripts è esclusa dalle pubblicazioni (scripts/vercel-ignore.sh).
set -euo pipefail

SCOPE="sog1t"

URLS=(
  volley-lignano-c4e8hrved-sog1t.vercel.app
  volley-lignano-aqodiv06x-sog1t.vercel.app
  volley-lignano-q8wdj8jgf-sog1t.vercel.app
  volley-lignano-mijldgwoh-sog1t.vercel.app
  volley-lignano-5l4say9xm-sog1t.vercel.app
  volley-lignano-co55acon7-sog1t.vercel.app
  volley-lignano-bseongboe-sog1t.vercel.app
  volley-lignano-58c5w5xpr-sog1t.vercel.app
  volley-lignano-2lg54u048-sog1t.vercel.app
  volley-lignano-61ce5xx9s-sog1t.vercel.app
  volley-lignano-qy91onbyn-sog1t.vercel.app
  volley-lignano-ackh0a0lq-sog1t.vercel.app
  volley-lignano-dyct1gxp4-sog1t.vercel.app
  volley-lignano-3px52bd83-sog1t.vercel.app
  volley-lignano-ioypgrc2n-sog1t.vercel.app
  volley-lignano-z9523h9c5-sog1t.vercel.app
  volley-lignano-hxd7dmsbe-sog1t.vercel.app
  volley-lignano-klqj94ole-sog1t.vercel.app
  volley-lignano-km6qe2tr6-sog1t.vercel.app
  volley-lignano-1wjhpcf72-sog1t.vercel.app
  volley-lignano-lhvh1yvps-sog1t.vercel.app
  volley-lignano-e418eqtdw-sog1t.vercel.app
  volley-lignano-qgnt3iz77-sog1t.vercel.app
  volley-lignano-od4wr1u7a-sog1t.vercel.app
  volley-lignano-dljw2c2x9-sog1t.vercel.app
  volley-lignano-23gmkx34g-sog1t.vercel.app
  volley-lignano-g30keujvf-sog1t.vercel.app
  volley-lignano-bh14mtrku-sog1t.vercel.app
  volley-lignano-j9h781bq1-sog1t.vercel.app
  volley-lignano-1zaaruuc0-sog1t.vercel.app
  volley-lignano-5ur7zlykp-sog1t.vercel.app
  volley-lignano-8kjk32l4w-sog1t.vercel.app
  volley-lignano-mbrlqki74-sog1t.vercel.app
  volley-lignano-loxm34dbn-sog1t.vercel.app
  volley-lignano-p6tzb4atp-sog1t.vercel.app
  volley-lignano-e62t0pji3-sog1t.vercel.app
  volley-lignano-19stkg7w6-sog1t.vercel.app
  volley-lignano-cicw4oi9z-sog1t.vercel.app
  volley-lignano-hypa1f7v5-sog1t.vercel.app
  volley-lignano-lhgm7m1pk-sog1t.vercel.app
  volley-lignano-7ifdmhzbo-sog1t.vercel.app
  volley-lignano-n3b3x4jeg-sog1t.vercel.app
  volley-lignano-5ealb4iv7-sog1t.vercel.app
  volley-lignano-e4483fip2-sog1t.vercel.app
  volley-lignano-56gwacb30-sog1t.vercel.app
  volley-lignano-jpsxjb75v-sog1t.vercel.app
  volley-lignano-bsbyvzlma-sog1t.vercel.app
  volley-lignano-bbq25jpmf-sog1t.vercel.app
  volley-lignano-lsfsu5jxr-sog1t.vercel.app
  volley-lignano-gvhjappag-sog1t.vercel.app
  volley-lignano-r8kx3lbjb-sog1t.vercel.app
  volley-lignano-aznl9l375-sog1t.vercel.app
  volley-lignano-mcx9zk9e8-sog1t.vercel.app
  volley-lignano-4ohm2xivt-sog1t.vercel.app
  volley-lignano-chsoy5ipv-sog1t.vercel.app
  volley-lignano-f245lm94w-sog1t.vercel.app
  volley-lignano-ogzwq09o3-sog1t.vercel.app
  volley-lignano-kh42eeyq7-sog1t.vercel.app
  volley-lignano-1op0alii4-sog1t.vercel.app
  volley-lignano-fkbc2aqvv-sog1t.vercel.app
  volley-lignano-gp2g8lngr-sog1t.vercel.app
  volley-lignano-37ua35olq-sog1t.vercel.app
  volley-lignano-ji77gthfe-sog1t.vercel.app
  volley-lignano-ahxidjj5y-sog1t.vercel.app
  volley-lignano-kdt8buswr-sog1t.vercel.app
  volley-lignano-opisous51-sog1t.vercel.app
  volley-lignano-f3byo9z9q-sog1t.vercel.app
  volley-lignano-a3u8x014z-sog1t.vercel.app
  volley-lignano-cdgyzv471-sog1t.vercel.app
  volley-lignano-m5qv0ozos-sog1t.vercel.app
  volley-lignano-dai8h8qk7-sog1t.vercel.app
  volley-lignano-plm6ivcdd-sog1t.vercel.app
  volley-lignano-fif24hktc-sog1t.vercel.app
  volley-lignano-mib516r6z-sog1t.vercel.app
  volley-lignano-96jkpoyrq-sog1t.vercel.app
  volley-lignano-qgttm84x4-sog1t.vercel.app
  volley-lignano-ofa0rg3yi-sog1t.vercel.app
  volley-lignano-e5uw7wk8a-sog1t.vercel.app
  volley-lignano-gbeodbj4x-sog1t.vercel.app
  volley-lignano-7izbj9x28-sog1t.vercel.app
  volley-lignano-iosmcqjnu-sog1t.vercel.app
  volley-lignano-8r1dgwt2g-sog1t.vercel.app
  volley-lignano-1n8wwgldk-sog1t.vercel.app
  volley-lignano-ilnerh8p7-sog1t.vercel.app
  volley-lignano-foinuz1yn-sog1t.vercel.app
  volley-lignano-qeiajxxeo-sog1t.vercel.app
  volley-lignano-7zc2rwiik-sog1t.vercel.app
  volley-lignano-a06b444rf-sog1t.vercel.app
  volley-lignano-95jsbss7k-sog1t.vercel.app
  volley-lignano-awdn3oeah-sog1t.vercel.app
  volley-lignano-7bwj7gxjn-sog1t.vercel.app
  volley-lignano-26y7qwm7a-sog1t.vercel.app
  volley-lignano-gqz36ijqe-sog1t.vercel.app
  volley-lignano-d3hbkt25v-sog1t.vercel.app
  volley-lignano-j0pvk0rgq-sog1t.vercel.app
  volley-lignano-ln8b982ve-sog1t.vercel.app
  volley-lignano-57n8y8d6q-sog1t.vercel.app
  volley-lignano-nuxy16wkg-sog1t.vercel.app
  volley-lignano-dlfqw50qs-sog1t.vercel.app
  volley-lignano-p8weqjtm1-sog1t.vercel.app
  volley-lignano-ak9dlergc-sog1t.vercel.app
  volley-lignano-q1stexufa-sog1t.vercel.app
  volley-lignano-3dja4vw55-sog1t.vercel.app
  volley-lignano-7iw63nn7q-sog1t.vercel.app
  volley-lignano-hvmc6r4sy-sog1t.vercel.app
  volley-lignano-2nhpnvnse-sog1t.vercel.app
  volley-lignano-51x1xb2kt-sog1t.vercel.app
  volley-lignano-izscabvja-sog1t.vercel.app
  volley-lignano-p4y8sdxgf-sog1t.vercel.app
  volley-lignano-o4blrsc8v-sog1t.vercel.app
  volley-lignano-l9uobhv2f-sog1t.vercel.app
  volley-lignano-phabe8a7j-sog1t.vercel.app
  volley-lignano-44ajolsnd-sog1t.vercel.app
  volley-lignano-76dzj9d1a-sog1t.vercel.app
  volley-lignano-ii47syx6n-sog1t.vercel.app
  volley-lignano-dkpprd5f8-sog1t.vercel.app
  volley-lignano-5qx1gdqxk-sog1t.vercel.app
  volley-lignano-fcxe07j0p-sog1t.vercel.app
  volley-lignano-qaijaihmv-sog1t.vercel.app
  volley-lignano-5zqbpt0e5-sog1t.vercel.app
  volley-lignano-61y80yh83-sog1t.vercel.app
  volley-lignano-g0037olys-sog1t.vercel.app
  volley-lignano-9kw54fwqp-sog1t.vercel.app
  volley-lignano-47xfm4mr9-sog1t.vercel.app
  volley-lignano-fw98z0o0j-sog1t.vercel.app
  volley-lignano-oa677yml0-sog1t.vercel.app
  volley-lignano-6c73t1kl4-sog1t.vercel.app
  volley-lignano-o6nc92zoo-sog1t.vercel.app
  volley-lignano-g15g7xteo-sog1t.vercel.app
  volley-lignano-9ikwoe2r2-sog1t.vercel.app
  volley-lignano-r5ffs6pnf-sog1t.vercel.app
  volley-lignano-nc0zytyvq-sog1t.vercel.app
  volley-lignano-el2g0ev9t-sog1t.vercel.app
  volley-lignano-7r7qab05a-sog1t.vercel.app
  volley-lignano-ggn70w4k7-sog1t.vercel.app
  volley-lignano-6kwt5d0ba-sog1t.vercel.app
  volley-lignano-hpgdbdm1o-sog1t.vercel.app
  volley-lignano-4v9sy9zuv-sog1t.vercel.app
  volley-lignano-p07cgdw3z-sog1t.vercel.app
  volley-lignano-qpjzwzz9u-sog1t.vercel.app
  volley-lignano-lcevcne2s-sog1t.vercel.app
  volley-lignano-7knotg0uj-sog1t.vercel.app
  volley-lignano-r2g5396bh-sog1t.vercel.app
  volley-lignano-f20h7i868-sog1t.vercel.app
  volley-lignano-klekop71c-sog1t.vercel.app
  volley-lignano-mypyg5bjl-sog1t.vercel.app
  volley-lignano-pxwpbf0f6-sog1t.vercel.app
  volley-lignano-27r7azuxg-sog1t.vercel.app
  volley-lignano-f18awjgjy-sog1t.vercel.app
  volley-lignano-6dta23as0-sog1t.vercel.app
  volley-lignano-1feztvu0x-sog1t.vercel.app
  volley-lignano-rmp1wpzn3-sog1t.vercel.app
  volley-lignano-erxxyvy5s-sog1t.vercel.app
  volley-lignano-c4hm0niho-sog1t.vercel.app
  volley-lignano-naxghxhqk-sog1t.vercel.app
  volley-lignano-piagm8ko3-sog1t.vercel.app
  volley-lignano-qx1pyv91j-sog1t.vercel.app
  volley-lignano-dk555hdez-sog1t.vercel.app
  volley-lignano-jp7fbbzik-sog1t.vercel.app
  volley-lignano-rd85qqcd6-sog1t.vercel.app
  volley-lignano-fqxlo95wx-sog1t.vercel.app
  volley-lignano-2sjbgqwhm-sog1t.vercel.app
  volley-lignano-dpjxc44w1-sog1t.vercel.app
  volley-lignano-mov6h9six-sog1t.vercel.app
  volley-lignano-61jyqkziv-sog1t.vercel.app
  volley-lignano-jl1maroqx-sog1t.vercel.app
  volley-lignano-91ligfuc9-sog1t.vercel.app
  volley-lignano-zf70pql49-sog1t.vercel.app
  volley-lignano-f08w2eg8t-sog1t.vercel.app
  volley-lignano-1j768a0pe-sog1t.vercel.app
  volley-lignano-8o7fyrmhu-sog1t.vercel.app
  volley-lignano-ogh48vfnj-sog1t.vercel.app
  volley-lignano-g4ipvrepg-sog1t.vercel.app
  volley-lignano-52r5uotqh-sog1t.vercel.app
  volley-lignano-4r5zxc51o-sog1t.vercel.app
  volley-lignano-6rlo6npoq-sog1t.vercel.app
  volley-lignano-b55ke9pi6-sog1t.vercel.app
  volley-lignano-8xfwz2mk8-sog1t.vercel.app
  volley-lignano-cy3eza1pd-sog1t.vercel.app
  volley-lignano-5c4qe90od-sog1t.vercel.app
  volley-lignano-einerhpde-sog1t.vercel.app
  volley-lignano-lydefeqn3-sog1t.vercel.app
  volley-lignano-6mc9oxta5-sog1t.vercel.app
  volley-lignano-huqd4wef8-sog1t.vercel.app
  volley-lignano-3p2qll3ub-sog1t.vercel.app
  volley-lignano-6q9lbzp33-sog1t.vercel.app
  volley-lignano-5ty50005s-sog1t.vercel.app
  volley-lignano-gownil2yb-sog1t.vercel.app
  volley-lignano-mva4ks83n-sog1t.vercel.app
  volley-lignano-i2vlql15j-sog1t.vercel.app
  volley-lignano-39xmy1bbh-sog1t.vercel.app
  volley-lignano-3o8dr8ue7-sog1t.vercel.app
  volley-lignano-ar4sbathf-sog1t.vercel.app
  volley-lignano-bgqeed1yc-sog1t.vercel.app
  volley-lignano-8bagp7yra-sog1t.vercel.app
  volley-lignano-5rh1te5bl-sog1t.vercel.app
  volley-lignano-p0z53bk8o-sog1t.vercel.app
  volley-lignano-116md87kf-sog1t.vercel.app
  volley-lignano-78myrik1m-sog1t.vercel.app
)

echo "Account Vercel collegato:"
npx --yes vercel@latest whoami --scope "$SCOPE"
echo
echo "Sto per cancellare ${#URLS[@]} pubblicazioni vecchie di volley-lignano (il sito online resta com'è)."
read -r -p "Scrivi si per continuare: " risposta
[ "$risposta" = "si" ] || { echo "Annullato."; exit 1; }

for ((i = 0; i < ${#URLS[@]}; i += 10)); do
  npx --yes vercel@latest remove --yes --scope "$SCOPE" "${URLS[@]:i:10}"
done

echo "Fatto. Controlla con: npx vercel ls volley-lignano --scope $SCOPE"
