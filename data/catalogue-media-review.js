// Reviewed exclusions: an official page can still attach the wrong picture.
// Keep the factual item; omit its photo instead of substituting unrelated art.
const kfcPosters = ["mighty-bucket","streetwise-6-family","streetwise-7-family","streetwise-8-family","crunchmaster-prego","streetwise-2-loaded-hot-crispy","sw-2-loaded","sw-5-loaded","family-fiesta","streetwise-bucket-4-1","dunked-streetwise-bucket-4-1","loaded-fries","streetwise-4","hot-crispy-sw-2","hot-crispy-sw-5","dunked-crunchmaster","zinger-crunchmaster","wing-lunch-box","dunked-wing-lunch-box","crunch-wing-box","dunked-wing-crunch-box","mega-wing-box","dunked-mega-wing-box","box-clever-lunch-box-jalapeno-crunch","box-clever-lunch-box-lunch-box-bbq-crunch","box-clever-lunch-box-dunked-box-clever-box-meal","all-star-lunch-box","dunked-all-star-lunch-box"];
const slicePosters = ["2-slicer","8-piece-bucket","bucket-meal-mega-chips","kid-slicer","lion-slicer-meal","slice-roll","medium-farm-salad","regular-farm-salad","cascade-1-litre","cascade-400ml","slush-350ml"];
export default {
  ...Object.fromEntries(["coleslaw-large","coleslaw-regular","dunked-nuggets","dunked-zinger-nuggets","mash-gravy-large","mash-gravy-regular","soft-drink-can"].map(id=>[`menu_kfc_${id}`,"Actual product pixels are too small after removing the source image's blank border."])),
  ...Object.fromEntries(kfcPosters.map(id=>[`menu_kfc_${id}`,"Promotional poster with embedded prices or shared meal variants; unsuitable as an item photo."])),
  ...Object.fromEntries(slicePosters.map(id=>[`menu_chicken-slice_chicken-slice-${id}`,"Text-heavy poster or generic promotion rather than a clean item photo."])),
  "menu_chicken-slice_chicken-slice-beef-burger":"Official source attaches a sausage-and-chips photograph to a beef burger.",
  "menu_chicken-slice_chicken-slice-chilli-chicken-burger":"Official source picture appears to show beef patties rather than chicken.",
  "menu_chicken-slice_chicken-slice-double-chicken-burger-meal":"Official source picture appears to show beef patties rather than chicken.",
  "menu_chicken-slice_chicken-slice-double-beef-burger-meal":"Meal source image omits the included sides and cannot establish the pictured portion.",
  "menu_chicken-slice_chicken-slice-extra-mushroom-sauce":"Official source picture shows red tomato-style sauce rather than identifiable mushroom sauce."
};
