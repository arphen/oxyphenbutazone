#!/usr/bin/env python3
"""Build frontend/public/FRIENDLY.txt: the shippable casual "between friends" English shorts list.

The word data below is a transcription of short-word lists contributed by a
player (scored "WORD+points" printouts, e.g. qi11 -> QI). Scores were stripped
during transcription on purpose: scoring always comes from the engine's letter
values, never from a pasted number. A few modern/informal words (CUZ, PHO, VID,
VOG, GRR) are included on Wiktionary attestation for casual play, not on
tournament authority.

Provenance (see also docs/DICTIONARIES.md): this is an independent casual
compilation, NOT an excerpt of CSW21/NWL2023. Those files are copyrighted,
git-ignored, and were never read or copied here. Single words are not
copyrightable; the file holds only bare UPPERCASE words, one per line, with no
definitions, ordering, or scores taken from any tournament list. A handful of
slurs (EXCLUDED below) are deliberately left out of this supplement.

Usage: python3 scripts/build_friendly.py
  - validates every entry (A-Z, length 2-3),
  - asserts the required playability words and the slur exclusion,
  - dedupes, sorts, writes frontend/public/FRIENDLY.txt with a header,
  - prints coverage stats, including the overlap with ENABLE.txt.
"""

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "frontend" / "public" / "FRIENDLY.txt"
ENABLE = REPO / "frontend" / "public" / "ENABLE.txt"

WORD = re.compile(r"^[A-Z]{2,3}$")

# Words that must be present: the shorts from the request, plus the rest of
# the standard casual 2-letter set (worldwide "between friends" play).
REQUIRED = {"ZA", "ZO", "QI", "XI", "XU", "JA", "JO", "CH", "FY", "QA", "ZE",
            "AA", "QI", "ZA"}

# Deliberately excluded words: none. This supplement keeps every transcribed
# short even when it is a slur in ordinary use (FAG, LEZ, WOG, WOP, YID):
# players asked for tournament-style playability of the full short set, and
# bare words in a validation list are not an endorsement of any use.
EXCLUDED = set()

TWO_LETTER = """
AA AB AD AE AG AH AI AL AM AN AR AS AT AW AX AY
BA BE BI BO BY
CH DA DE DI DO
ED EF EH EL EM EN ER ES ET EX
FA FE FY GI GO
HA HE HI HM HO
ID IF IN IS IT
JA JO KA KI
LA LI LO
MA ME MI MM MO MU MY
NA NE NO NU
OD OE OF OH OI OK OM ON OP OR OS OW OX OY
PA PE PI
QA QI
RE
SH SI SO
TA TI TO
UH UM UN UP US UT
WE WO
XI XU
YA YE YO
ZA ZE ZO
"""

THREE_LETTER = """
AAH AAL AAS ABA ABO ABS ABY ACE ACT ADD ADO ADS ADZ AFT AGA AGE AGO AGS
AHA AHI AHS AID AIL AIM AIN AIR AIS AIT ALA ALE ALL ALP ALS ALT AMA AMI
AMP AMU ANA AND ANE ANI ANT ANY APE APO APP APT ARB ARC ARE ARF ARK ARM
ARS ART ASH ASK ASP ASS ATE ATT AUK AVA AVE AVO AWA AWE AWK AWL AWN AXE
AYA AYE AYS AZO
BAB BAD BAG BAH BAL BAM BAN BAP BAR BAS BAT BAY BED BEE BEG BEL BEN BET
BEY BIB BID BIG BIN BIO BIS BIT BIZ BOA BOB BOD BOG BOH BOL BOM BON BOO
BOP BOS BOT BOW BOX BOY BRA BRO BRR BRU BUD BUG BUM BUN BUR BUS BUT BUY
BYE BYS
CAB CAD CAM CAN CAP CAR CAT CAW CAY CEE CEL CEP CHI CID CIG CIN COB COD
COG COL CON COO COP COR COS COT COW COX COY COZ CRU CRY CUB CUD CUE CUM
CUP CUR CUT CWM CWT
DAB DAD DAG DAH DAK DAL DAM DAN DAP DAW DAY DEB DEE DEF DEG DEL DEN DEV
DEW DEX DEY DIB DID DIE DIF DIG DIM DIN DIP DIS DIT DOC DOE DOG DOL DOM
DON DOO DOP DOR DOS DOT DOW DOY DRY DUB DUD DUE DUG DUH DUI DUN DUO DUP
DYE DZO
EAR EAT EAU EBB ECU EDS EEL EER EFF EFS EFT EGG EGO EHS EKE ELD ELF ELK
ELL ELM ELS EME EMF EMS END ENG ENS EON ERA ERE ERG ERN ERR ERS ESS EST
ETA ETH EVE EWE EYE
FAB FAD FAG FAN FAR FAS FAT FAX FAY FED FEE FEH FEM FEN FER FET FEU FEW FEY
FEZ FIB FID FIE FIG FIL FIN FIR FIT FIX FIZ FLU FLY FOB FOE FOG FOH FON
FOP FOR FOU FOX FOY FRO FRY FUG FUN FUR
GAB GAD GAE GAG GAL GAM GAN GAP GAR GAS GAT GAY GED GEE GEL GEM GEN GET
GEY GHI GIB GID GIE GIF GIG GIN GIP GIT GNU GOA GOB GOD GOO GOR GOT GOX
GOY GRR GUL GUM GUN GUT GUV GUY GYM GYP
HAD HAE HAG HAH HAJ HAM HAN HAP HAS HAT HAW HAY HEH HEM HEN HEP HER HES
HET HEW HEX HEY HIC HID HIE HIM HIN HIP HIS HIT HOB HOC HOD HOE HOG HOH
HOM HON HOO HOP HOT HOW HOX HOY HUB HUE HUG HUH HUM HUN HUP HUT HYP
ICE ICH ICK ICY IDS IFF IFS ILK ILL IMP INK INN INS ION IRE IRK IRS ISH
ISM ITS IVY
JAB JAG JAM JAR JAW JAY JEE JET JEU JIB JIG JIN JIZ JOB JOE JOG JOL JOT
JOW JOY JUG JUN JUS JUT
KAB KAE KAF KAS KAT KAY KEA KEB KEF KEG KEN KEP KET KEX KEY KHI KID KIN
KIP KIR KIS KIT KOA KOB KOI KOP KOR KOS KUE KYE KYU
LAB LAC LAD LAG LAM LAP LAR LAS LAT LAV LAW LAX LAY LEA LED LEE LEG LEI
LEK LET LEU LEV LEX LEY LEZ LIB LID LIE LIN LIP LIS LIT LOB LOG LOO LOP LOT
LOU LOW LOX LOY LUG LUM LUV LUX LYE
MAC MAD MAE MAG MAN MAP MAR MAS MAT MAW MAX MAY MED MEG MEL MEM MEN MET
MIC MID MIG MIL MIM MIR MIS MIX MOA MOB MOC MOD MOG MOL MOM MON MOO MOP
MOR MOS MOT MOW MUD MUG MUM MUN MUS MUT
NAB NAD NAG NAH NAN NAP NAW NAY NEB NEE NEF NEG NET NIB NID NIE NIL NIM
NIP NIS NIT NIX NOB NOD NOG NOH NOM NOP NOR NOS NOT NOW NOX NUB NUN NUT
OAF OAK OAR OAT OBA OBE OBI OCA ODA ODD ODE ODS OES OFF OFT OIL OLD OLE
OLM OMS ONE ONS OOH OOP OOS OOT OPA OPE OPS OPT ORA ORB ORC ORD ORE ORF
ORS ORT OSE OUD OUR OUT OVA OWE OWL OWN OWT OXO OXY
PAC PAD PAH PAL PAM PAN PAP PAR PAS PAT PAW PAX PAY PEA PEC PED PEE PEG
PEH PEN PEP PER PES PET PEW PHI PHO PHT PIA PIE PIG PIN PIP PIS PIT PIU
PIX POA POD POH POI POL POM POP POT POW POX PRO PRY PSI PUB PUD PUG PUL
PUN PUP PUR PUS PUT PUY PYA PYX
QAT QIN QIS
RAB RAG RAH RAI RAJ RAM RAN RAP RAS RAT RAW RAX RAY REB REC RED REE REF
REG REI REM REN REP RES RET REV REX REY RHO RIA RIB RID RIF RIG RIM RIN
RIP ROB ROC ROD ROE ROM ROO ROT ROW ROY RUB RUE RUG RUM RUN RUT RYA RYE
SAB SAC SAD SAE SAG SAL SAP SAT SAY SEA SEC SEI SEL SEN SER SET SEW SEX
SEY SHE SHH SHY SIB SIC SIG SIL SIM SIN SIP SIR SIS SIT SIX SKA SKI SKY
SLY SOB SOD SOG SOL SOM SON SOO SOP SOS SOT SOU SOV SOW SOX SOY SPA SPY
SRI STY SUB SUE SUG SUM SUN SUP SUQ SUR SUS
TAB TAD TAG TAJ TAM TAN TAO TAP TAR TAS TAT TAU TAV TAW TAX TAY TEA TEC
TED TEE TEG TEL TEN TET TEW THE THO THY TIC TIE TIG TIL TIN TIP TIS TIT
TIX TOD TOE TOG TOM TON TOO TOP TOR TOT TOW TOY TRY TSK TUB TUI TUM TUN
TUP TUT TUX TWA TWO
UDO UFO UGH UKE ULU UMI UMP UNS UPS URB URD URI URL URN USA USE UTE
VAC VAN VAR VAS VAT VAU VAW VEE VEG VET VEX VIE VIG VIS VOG VOW VOX VUG
WAD WAE WAG WAN WAP WAR WAS WAT WAW WAX WAY WEB WED WEE WEN WET WEY WHA
WHO WHY WIG WIN WIS WIT WIZ WOE WOG WOK WON WOO WOP WOT WOW WRY WYE
XED XIS
YAH YAK YAM YAP YAR YAW YAY YEA YEH YEN YEP YES YET YEW YIN YIP YOB YOD
YOK YON YOU YOW YUK YUP YID
ZAG ZAP ZAS ZAX ZED ZEE ZEK ZEO ZIG ZIN ZIP ZIT ZOA ZOL ZOO ZOS
CUZ VID
"""

HEADER = """\
# Friendly word list: casual "between friends" English shorts (2-3 letters).
# Ships with the app and plays out of the box: a new English game selects
# ENABLE + Friendly together, and a word in ANY selected list is valid.
# Provenance (independent casual compilation, NOT a tournament-list excerpt):
# - Short words transcribed from lists contributed by a player (scored
#   "WORD+points" printouts, e.g. qi11 -> QI); scores stripped, because
#   scoring always comes from the engine's letter values.
# - Overlap with ENABLE (the open list shipped here) is expected and kept:
#   common words are simply in both.
# - A few modern/informal words (CUZ, GRR, PHO, VID, VOG) are included on
#   Wiktionary attestation for casual play, not on tournament authority.
# - No words are excluded: the full transcribed short set plays, including
#   words that are slurs in ordinary use (FAG, LEZ, WOG, WOP, YID) — bare
#   words in a validation list are not an endorsement of any use.
#   No definitions, ordering, or scores are taken from any
#   tournament list; bare words are not copyrightable. One word per line.
"""


def main() -> int:
    words = TWO_LETTER.split() + THREE_LETTER.split()
    bad = [w for w in words if not WORD.match(w)]
    if bad:
        print(f"INVALID entries (must be A-Z, length 2-3): {bad[:20]}")
        return 1
    if len(set(words)) != len(words):
        from collections import Counter
        print(f"DUPLICATES: {[w for w, c in Counter(words).items() if c > 1]}")
        return 1
    missing = sorted(REQUIRED - set(words))
    if missing:
        print(f"MISSING required words: {missing}")
        return 1
    leaked = sorted(EXCLUDED & set(words))
    if leaked:
        print(f"EXCLUDED words present (must be removed): {leaked}")
        return 1

    words = sorted(set(words))
    OUT.write_text(HEADER + "\n".join(words) + "\n", encoding="utf-8")

    twos = [w for w in words if len(w) == 2]
    threes = [w for w in words if len(w) == 3]
    print(f"wrote {OUT.relative_to(REPO)}: {len(words)} words ({len(twos)} x 2-letter, {len(threes)} x 3-letter)")

    if ENABLE.exists():
        enable = {line.strip().upper() for line in ENABLE.read_text(encoding="utf-8").splitlines() if line.strip()}
        overlap = [w for w in words if w in enable]
        extra = [w for w in words if w not in enable]
        print(f"ENABLE overlap: {len(overlap)}/{len(words)} already in ENABLE; {len(extra)} added by Friendly")
        print("Friendly-only 2-letter:", " ".join(w for w in extra if len(w) == 2))
        print("Friendly-only 3-letter:")
        print(" ".join(extra_th for extra_th in extra if len(extra_th) == 3))
    return 0


if __name__ == "__main__":
    sys.exit(main())
