# Stage art

`stage-1.png` … `stage-7.png` live here, one per stage, generated once and
committed. `npm run art` writes them.

Character consistency comes from a reference image. Drop the punk in as
`reference.png` — `cell.png` from the jailbreak repo is the obvious choice — and
every stage is generated against it. With no reference present, stage 1 is
generated cold and becomes the reference for the other six.

Until a stage has a PNG the game shows a labelled holding frame, so it is
playable with this directory empty.
