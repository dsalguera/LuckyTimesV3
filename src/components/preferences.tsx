"use client";
import {useEffect,useState} from "react";
import {Languages,Sun,Moon} from "lucide-react";
import dictionary from "@/app/i18n/dictionary.json";
type Language="es"|"en";
type Theme="dark"|"light";
const map=dictionary as Record<string,string>;
const reverse=Object.fromEntries(Object.entries(map).map(([es,en])=>[en,es]));
function translate(input:string,language:Language){
  if(language==="es")return reverse[input]||input;
  return map[input]||input;
}
export default function Preferences(){
 const [language,setLanguage]=useState<Language>("es");
 const [theme,setTheme]=useState<Theme>("dark");
 useEffect(()=>{
  const savedLanguage=localStorage.getItem("lt-language");
  const savedTheme=localStorage.getItem("lt-theme");
  const detected=(navigator.languages?.[0]||navigator.language||"es").toLowerCase().startsWith("es")?"es":"en";
  setLanguage(savedLanguage==="es"||savedLanguage==="en"?savedLanguage:detected);
  setTheme(savedTheme==="dark"||savedTheme==="light"?savedTheme:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"));
 },[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem("lt-theme",theme)},[theme]);
 useEffect(()=>{
  document.documentElement.lang=language;
  localStorage.setItem("lt-language",language);
  // Existing modules contain server-generated and dynamic UI text. Translate without changing DB values.
  let working=false;
  const visit=(root:Node)=>{
   if(root instanceof Element && (root.closest("[data-no-translate]")||["SCRIPT","STYLE","CODE","PRE"].includes(root.tagName)))return;
   if(root.nodeType===Node.TEXT_NODE){
    const original=root.textContent||"";
    const trimmed=original.trim();
    if(!trimmed)return;
    const target=translate(trimmed,language);
    if(target!==trimmed)root.textContent=original.replace(trimmed,target);
    return;
   }
   if(root instanceof Element){
    for(const key of ["placeholder","title","aria-label"]){
     const old=root.getAttribute(key);
     if(old){const newer=translate(old,language);if(newer!==old)root.setAttribute(key,newer)}
    }
   }
   for(const child of Array.from(root.childNodes))visit(child);
  };
  const update=()=>{if(working)return;working=true;try{visit(document.querySelector(".app-shell")||document.body)}finally{working=false}};
  update();
  const observer=new MutationObserver(()=>update());
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["placeholder","title","aria-label"]});
  return ()=>observer.disconnect();
 },[language]);
 return <div className="lt-preferences" data-no-translate="true" aria-label="Display preferences">
   <button type="button" className="lt-pref-btn" onClick={()=>setTheme(theme==="dark"?"light":"dark")} title={theme==="dark"?"Light mode":"Dark mode"} aria-label={theme==="dark"?"Enable light mode":"Enable dark mode"}>{theme==="dark"?<Sun size={16}/>:<Moon size={16}/>}<span>{theme==="dark"?"Light":"Dark"}</span></button>
   <button type="button" className="lt-pref-btn" onClick={()=>setLanguage(language==="es"?"en":"es")} title="Switch language" aria-label="Switch language"><Languages size={16}/><span>{language==="es"?"EN":"ES"}</span></button>
 </div>;
}
