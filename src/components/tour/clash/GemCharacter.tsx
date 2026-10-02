import { useId } from "react";

const FACE_SRC = "/tour/gem-viso.webp";

/** Gem, il boia dei Test fisici: caricatura in stile "Clash" di un
 * allenatore vestito da boia — cappuccio abbassato, imbracatura di cuoio,
 * scure a doppia lama e fischietto. Il viso, con i suoi lineamenti veri, è
 * un'immagine a ombre piatte e tratti a inchiostro ricavata da una foto
 * (public/tour/gem-viso.webp); capelli e costume sono vettoriali. Mentre
 * "parla" la testa fa un cenno (vedi .gem-head in globals.css). Gli id
 * interni passano da useId: due istanze nella stessa pagina non si rubano
 * clipPath e maschere. */
export function GemCharacter({ className, talking = false }: { className?: string; talking?: boolean }) {
  const uid = useSvgUid();

  return (
    <svg
      viewBox="-70 -20 1090 1030"
      className={className}
      data-talking={talking || undefined}
      role="img"
      aria-label="Gem, il boia dei Test fisici"
    >
      {/* scure (dietro a tutto) */}
      <g transform="translate(150 404) rotate(-17) scale(0.92)">
        <rect x="-17" y="-60" width="34" height="620" rx="14" fill="#9A6A3A" stroke="#28191D" strokeWidth="10" />
        <rect x="3" y="-50" width="9" height="600" rx="4" fill="#7A4F28" />
        <g fill="#3B2D4D" stroke="#28191D" strokeWidth="6">
          <rect x="-21" y="330" width="42" height="34" rx="8" />
          <rect x="-21" y="372" width="42" height="34" rx="8" />
          <rect x="-21" y="414" width="42" height="34" rx="8" />
        </g>
        <path
          d="M0 -150 L22 -88 L0 -64 L-22 -88 Z"
          fill="#C3CDD8"
          stroke="#28191D"
          strokeWidth="9"
          strokeLinejoin="round"
        />
        {/* lama sinistra */}
        <path
          d="M-24 -40 C-80 -56 -140 -96 -168 -146 C-214 -60 -216 70 -168 156 C-140 112 -82 76 -24 66 Z"
          fill="#AEB9C6"
          stroke="#28191D"
          strokeWidth="11"
          strokeLinejoin="round"
        />
        <path
          d="M-150 -112 C-186 -44 -188 56 -152 124 C-140 104 -128 92 -118 84 C-142 30 -142 -24 -124 -76 Z"
          fill="#E6ECF2"
        />
        <path d="M-24 -32 C-64 -40 -94 -56 -112 -70 L-112 92 C-90 80 -60 66 -24 58 Z" fill="#8F9BAA" opacity="0.7" />
        {/* lama destra */}
        <path
          d="M24 -40 C80 -56 140 -96 168 -146 C214 -60 216 70 168 156 C140 112 82 76 24 66 Z"
          fill="#AEB9C6"
          stroke="#28191D"
          strokeWidth="11"
          strokeLinejoin="round"
        />
        <path d="M150 -112 C186 -44 188 56 152 124 C140 104 128 92 118 84 C142 30 142 -24 124 -76 Z" fill="#E6ECF2" />
        {/* mozzo */}
        <rect x="-30" y="-56" width="60" height="136" rx="12" fill="#6F7B8B" stroke="#28191D" strokeWidth="10" />
        <circle cx="0" cy="-24" r="8" fill="#D9E1EA" stroke="#28191D" strokeWidth="4" />
        <circle cx="0" cy="12" r="8" fill="#D9E1EA" stroke="#28191D" strokeWidth="4" />
        <circle cx="0" cy="48" r="8" fill="#D9E1EA" stroke="#28191D" strokeWidth="4" />
      </g>
      {/* busto: spalle e braccia nude */}
      <path
        d="M150 1010 C120 920 110 820 170 760 C220 712 300 690 380 690 L620 690 C700 690 780 712 830 760 C890 820 880 920 850 1010 Z"
        fill="#F4B79C"
        stroke="#28191D"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <path
        d="M175 1000 C160 920 160 850 200 800 C230 770 270 752 300 746 C250 790 230 860 236 1000 Z"
        fill="#FFD9C6"
        opacity="0.8"
      />
      <path
        d="M830 1000 C850 920 850 850 810 790 C790 770 770 760 750 752 C790 800 800 880 790 1000 Z"
        fill="#DB8C78"
      />
      {/* giubba di cuoio */}
      <path
        d="M300 720 C380 700 620 700 700 720 C730 800 742 900 748 1010 L252 1010 C258 900 270 800 300 720 Z"
        fill="#6E4128"
        stroke="#28191D"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <path
        d="M640 712 C676 716 692 720 700 724 C726 800 738 900 744 1006 L680 1006 C676 900 664 800 640 712 Z"
        fill="#583220"
      />
      <path
        d="M318 740 C312 800 304 880 300 1000"
        fill="none"
        stroke="#8C5636"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* bretelle incrociate con borchie */}
      <g stroke="#28191D" strokeWidth="9" strokeLinejoin="round">
        <path d="M330 712 L392 704 L720 1010 L640 1010 Z" fill="#40261A" />
        <path d="M670 712 L608 704 L280 1010 L360 1010 Z" fill="#40261A" />
      </g>
      <g fill="#C9D1DA" stroke="#28191D" strokeWidth="4">
        <circle cx="400" cy="742" r="8" />
        <circle cx="455" cy="794" r="8" />
        <circle cx="625" cy="956" r="8" />
        <circle cx="600" cy="742" r="8" />
        <circle cx="545" cy="794" r="8" />
        <circle cx="375" cy="956" r="8" />
      </g>
      {/* fibbia centrale */}
      <circle cx="500" cy="876" r="44" fill="#AEB9C6" stroke="#28191D" strokeWidth="10" />
      <circle cx="500" cy="876" r="24" fill="#6E4128" stroke="#28191D" strokeWidth="6" />
      <path d="M472 852 A36 36 0 0 1 528 848" fill="none" stroke="#E6ECF2" strokeWidth="7" strokeLinecap="round" />
      {/* spallaccio d'acciaio a destra */}
      <path
        d="M690 716 C760 690 850 712 880 780 C890 806 884 830 870 846 C820 800 760 780 700 790 Z"
        fill="#8F9BAA"
        stroke="#28191D"
        strokeWidth="11"
        strokeLinejoin="round"
      />
      <path d="M720 726 C780 712 836 730 862 776" fill="none" stroke="#D9E1EA" strokeWidth="9" strokeLinecap="round" />
      <g fill="#D9E1EA" stroke="#28191D" strokeWidth="4">
        <circle cx="730" cy="770" r="7" />
        <circle cx="790" cy="766" r="7" />
        <circle cx="846" cy="794" r="7" />
      </g>
      <g transform="translate(190 0)">
        <GemHeadArt uid={uid} />
      </g>
      {/* mantello sulle spalle */}
      <path
        d="M150 820 C150 760 200 714 270 696 L740 696 C810 714 860 760 860 820 C820 800 780 796 740 806 C700 760 640 742 600 744 L420 744 C370 742 310 760 270 806 C230 796 190 800 150 820 Z"
        fill="#3B2D4D"
        stroke="#28191D"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <path
        d="M190 780 C220 750 250 736 290 728 M820 780 C790 750 760 736 720 728"
        fill="none"
        stroke="#54426B"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* cappuccio abbassato: drappeggio a V sotto il mento */}
      <path
        d="M268 628 C330 650 400 700 510 716 C620 700 690 650 752 628 C790 660 792 720 744 760 C680 800 600 820 510 880 C420 820 340 800 276 760 C228 720 230 660 268 628 Z"
        fill="#3B2D4D"
        stroke="#28191D"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <path
        d="M282 650 C340 676 410 716 510 730 C610 716 680 676 738 650 C744 664 744 676 738 688 C680 716 600 744 510 750 C420 744 340 716 282 688 C276 676 276 664 282 650 Z"
        fill="#221A2C"
      />
      <path
        d="M330 760 C390 790 450 816 500 860 M690 760 C630 790 570 816 520 860 M420 770 C450 800 480 830 505 866"
        fill="none"
        stroke="#54426B"
        strokeWidth="9"
        strokeLinecap="round"
      />
      {/* manico davanti alla spalla, poi il pugno */}
      <g transform="translate(150 404) rotate(-17) scale(0.92)">
        <rect x="-17" y="300" width="34" height="320" rx="14" fill="#9A6A3A" stroke="#28191D" strokeWidth="10" />
        <rect x="3" y="310" width="9" height="300" rx="4" fill="#7A4F28" />
      </g>
      {/* cordino e fischietto da allenatore */}
      <path d="M420 724 C440 780 490 806 560 810" fill="none" stroke="#E2463B" strokeWidth="7" strokeLinecap="round" />
      <g transform="translate(580 816) rotate(-14)">
        <rect x="-20" y="-16" width="62" height="32" rx="14" fill="#C9D1DA" stroke="#28191D" strokeWidth="7" />
        <circle cx="-14" cy="6" r="22" fill="#C9D1DA" stroke="#28191D" strokeWidth="7" />
        <circle cx="-14" cy="6" r="8" fill="#28191D" />
        <path d="M-4 -10 L36 -10" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      </g>
      {/* pugno sinistro che stringe il manico */}
      <g transform="translate(296 900) rotate(-17)">
        <path
          d="M-56 140 C-64 80 -60 30 -40 6 L40 2 C60 30 64 80 58 140 Z"
          fill="#3B2D4D"
          stroke="#28191D"
          strokeWidth="10"
          strokeLinejoin="round"
        />
        <path d="M-48 10 L52 4" stroke="#C9D1DA" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M-58 -40 C-60 -84 -24 -104 12 -100 C50 -96 66 -66 62 -32 C60 -4 40 12 4 12 C-30 12 -56 0 -58 -40 Z"
          fill="#F4B79C"
          stroke="#28191D"
          strokeWidth="10"
          strokeLinejoin="round"
        />
        <path
          d="M-30 -96 C-34 -70 -34 -50 -26 -30 M4 -100 C0 -74 0 -54 6 -34 M36 -92 C34 -70 34 -52 40 -36"
          fill="none"
          stroke="#C98270"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/** Solo la testa di Gem con il colletto del cappuccio, per l'easter egg
 * che sbuca dai bordi dell'area tecnici (vedi GemPeek.tsx). */
export function GemHead({ className, talking = false }: { className?: string; talking?: boolean }) {
  const uid = useSvgUid();

  return (
    <svg viewBox="-22 -16 652 900" className={className} data-talking={talking || undefined} aria-hidden>
      <GemHeadArt uid={uid} />
      <g transform="translate(-190 0)">
        {/* cappuccio abbassato: drappeggio a V sotto il mento */}
        <path
          d="M268 628 C330 650 400 700 510 716 C620 700 690 650 752 628 C790 660 792 720 744 760 C680 800 600 820 510 880 C420 820 340 800 276 760 C228 720 230 660 268 628 Z"
          fill="#3B2D4D"
          stroke="#28191D"
          strokeWidth="12"
          strokeLinejoin="round"
        />
        <path
          d="M282 650 C340 676 410 716 510 730 C610 716 680 676 738 650 C744 664 744 676 738 688 C680 716 600 744 510 750 C420 744 340 716 282 688 C276 676 276 664 282 650 Z"
          fill="#221A2C"
        />
        <path
          d="M330 760 C390 790 450 816 500 860 M690 760 C630 790 570 816 520 860 M420 770 C450 800 480 830 505 866"
          fill="none"
          stroke="#54426B"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function useSvgUid() {
  return useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Viso e capelli, nelle coordinate della testa. */
function GemHeadArt({ uid }: { uid: string }) {
  return (
    <>
      <g className="gem-head">
        <image href={FACE_SRC} x="0" y="0" width="605" height="740" />
        <mask id={`${uid}faceAlpha`} style={{ maskType: "alpha" }}>
          <image href={FACE_SRC} x="0" y="0" width="605" height="740" />
        </mask>
        {/* capelli */}
        <defs>
          <clipPath id={`${uid}hairClip`}>
            <path d="M127 318 Q100 319 89 310 Q86 280 82 252 Q51 252 38 243 Q42 211 45 182 Q12 164 7 154 Q40 133 69 112 Q63 86 69 83 Q105 79 138 73 Q143 52 152 49 Q184 52 214 53 Q223 24 232 18 Q262 38 290 55 Q312 29 340 27 Q349 34 360 39 Q395 25 423 30 Q426 50 432 68 Q472 66 496 86 Q494 99 495 111 Q533 99 562 105 Q559 125 559 144 Q586 173 591 200 Q570 208 553 218 Q577 251 577 281 Q558 287 543 296 Q550 335 538 360 Q520 354 503 352 Q531 376 522 400 Q514 368 486 344 Q478 370 458 368 Q454 349 430 338 Q422 364 402 362 Q397 344 372 334 Q361 364 338 366 Q312 347 306 336 Q282 362 270 360 Q244 343 238 334 Q211 365 196 368 Q168 350 160 340 Q138 358 128 348 Q114 333 127 318 Z" />
          </clipPath>
        </defs>
        <path
          mask={`url(#${uid}faceAlpha)`}
          transform="translate(0 14)"
          d="M127 318 Q100 319 89 310 Q86 280 82 252 Q51 252 38 243 Q42 211 45 182 Q12 164 7 154 Q40 133 69 112 Q63 86 69 83 Q105 79 138 73 Q143 52 152 49 Q184 52 214 53 Q223 24 232 18 Q262 38 290 55 Q312 29 340 27 Q349 34 360 39 Q395 25 423 30 Q426 50 432 68 Q472 66 496 86 Q494 99 495 111 Q533 99 562 105 Q559 125 559 144 Q586 173 591 200 Q570 208 553 218 Q577 251 577 281 Q558 287 543 296 Q550 335 538 360 Q520 354 503 352 Q531 376 522 400 Q514 368 486 344 Q478 370 458 368 Q454 349 430 338 Q422 364 402 362 Q397 344 372 334 Q361 364 338 366 Q312 347 306 336 Q282 362 270 360 Q244 343 238 334 Q211 365 196 368 Q168 350 160 340 Q138 358 128 348 Q114 333 127 318 Z"
          fill="#E0977B"
        />
        <path
          d="M127 318 Q100 319 89 310 Q86 280 82 252 Q51 252 38 243 Q42 211 45 182 Q12 164 7 154 Q40 133 69 112 Q63 86 69 83 Q105 79 138 73 Q143 52 152 49 Q184 52 214 53 Q223 24 232 18 Q262 38 290 55 Q312 29 340 27 Q349 34 360 39 Q395 25 423 30 Q426 50 432 68 Q472 66 496 86 Q494 99 495 111 Q533 99 562 105 Q559 125 559 144 Q586 173 591 200 Q570 208 553 218 Q577 251 577 281 Q558 287 543 296 Q550 335 538 360 Q520 354 503 352 Q531 376 522 400 Q514 368 486 344 Q478 370 458 368 Q454 349 430 338 Q422 364 402 362 Q397 344 372 334 Q361 364 338 366 Q312 347 306 336 Q282 362 270 360 Q244 343 238 334 Q211 365 196 368 Q168 350 160 340 Q138 358 128 348 Q114 333 127 318 Z"
          fill="#F2EFEB"
        />
        <g clipPath={`url(#${uid}hairClip)`}>
          <path
            d="M60 300 C160 262 300 280 420 250 C480 236 520 200 560 150 L640 150 L640 460 L40 460 Z"
            fill="#DAD3D0"
          />
          <path d="M120 352 C220 320 420 318 560 350 L560 460 L120 460 Z" fill="#C4BAB8" />
          <path d="M229 235 Q154 263 89 310 Q158 272 236 249 Z" fill="#CCC3C0" />
          <path d="M212 208 Q123 214 38 243 Q125 224 214 224 Z" fill="#CCC3C0" />
          <path d="M202 175 Q106 152 7 154 Q105 162 200 191 Z" fill="#CCC3C0" />
          <path d="M228 148 Q153 106 69 83 Q149 114 221 163 Z" fill="#CCC3C0" />
          <path d="M262 137 Q213 86 152 49 Q207 93 251 149 Z" fill="#CCC3C0" />
          <path d="M294 127 Q270 69 232 18 Q262 73 279 134 Z" fill="#CCC3C0" />
          <path d="M335 135 Q345 82 340 27 Q335 81 319 133 Z" fill="#CCC3C0" />
          <path d="M366 139 Q401 89 423 30 Q393 84 352 131 Z" fill="#CCC3C0" />
          <path d="M391 163 Q448 132 496 86 Q443 124 382 150 Z" fill="#CCC3C0" />
          <path d="M415 171 Q492 148 562 105 Q489 139 409 156 Z" fill="#CCC3C0" />
          <path d="M423 208 Q507 215 591 200 Q507 205 423 192 Z" fill="#CCC3C0" />
          <path d="M415 238 Q493 270 577 281 Q496 261 420 223 Z" fill="#CCC3C0" />
          <path d="M398 267 Q462 322 538 360 Q467 315 408 254 Z" fill="#CCC3C0" />
          <path d="M428 290 Q438 330 458 368 Q447 328 442 286 Z" fill="#B3A8A6" />
          <path d="M382 283 Q387 323 402 362 Q396 322 396 281 Z" fill="#B3A8A6" />
          <path d="M330 286 Q329 326 338 366 Q337 326 344 286 Z" fill="#B3A8A6" />
          <path d="M274 279 Q267 319 270 360 Q276 320 288 281 Z" fill="#B3A8A6" />
          <path d="M213 286 Q200 326 196 368 Q208 328 227 290 Z" fill="#B3A8A6" />
          <path d="M303 139 Q233 101 150 110 Q229 114 297 161 Z" fill="#FFFFFF" />
          <path d="M340 140 Q328 100 330 60 Q316 100 320 140 Z" fill="#FFFFFF" />
          <path d="M353 158 Q406 116 470 100 Q402 106 347 142 Z" fill="#FFFFFF" />
          <path d="M279 181 Q198 170 120 200 Q199 181 281 199 Z" fill="#FFFFFF" />
        </g>
        <path
          d="M127 318 Q100 319 89 310 Q86 280 82 252 Q51 252 38 243 Q42 211 45 182 Q12 164 7 154 Q40 133 69 112 Q63 86 69 83 Q105 79 138 73 Q143 52 152 49 Q184 52 214 53 Q223 24 232 18 Q262 38 290 55 Q312 29 340 27 Q349 34 360 39 Q395 25 423 30 Q426 50 432 68 Q472 66 496 86 Q494 99 495 111 Q533 99 562 105 Q559 125 559 144 Q586 173 591 200 Q570 208 553 218 Q577 251 577 281 Q558 287 543 296 Q550 335 538 360 Q520 354 503 352 Q531 376 522 400 Q514 368 486 344 Q478 370 458 368 Q454 349 430 338 Q422 364 402 362 Q397 344 372 334 Q361 364 338 366 Q312 347 306 336 Q282 362 270 360 Q244 343 238 334 Q211 365 196 368 Q168 350 160 340 Q138 358 128 348 Q114 333 127 318 Z"
          fill="none"
          stroke="#28191D"
          strokeWidth="13"
          strokeLinejoin="round"
        />
      </g>
    </>
  );
}
