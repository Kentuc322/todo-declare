export function createFeedback(document) {
  const host=document.createElement('div');
  host.id='toast';host.className='toast';host.setAttribute('role','status');host.setAttribute('aria-live','polite');
  document.body.append(host);
  let timer;
  return (message,kind='success')=>{
    clearTimeout(timer);
    host.textContent=message;host.dataset.kind=kind;host.classList.add('visible');
    if(kind!=='error'&&kind!=='pending')timer=setTimeout(()=>host.classList.remove('visible'),5000);
  };
}
