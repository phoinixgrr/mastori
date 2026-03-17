(function() {
  fetch('/api/solar-status.json?' + Date.now())
    .then(function(r) { return r.json(); })
    .then(function(d) {
      // Footer badge
      var el = document.getElementById('solar-badge');
      if (el) {
        if (d.solar) {
          el.innerHTML = '\u2600\uFE0F <strong>Solar powered</strong> \u00B7 PV ' + d.pv_w + 'W \u00B7 Battery ' + d.soc + '%';
          el.className = 'solar-badge solar-on';
        } else {
          el.innerHTML = '\uD83D\uDD0C Grid powered \u00B7 PV ' + d.pv_w + 'W \u00B7 Battery ' + d.soc + '%';
          el.className = 'solar-badge solar-off';
        }
        el.style.display = 'inline-block';
      }

      // About page live status
      var about = document.getElementById('solar-live-about');
      if (about) {
        if (d.solar) {
          about.innerHTML = '\u2600\uFE0F <strong>Right now, this page is being served by solar power.</strong> PV producing ' + d.pv_w + 'W, battery at ' + d.soc + '%.';
        } else {
          about.innerHTML = '\uD83D\uDD0C <em>Right now, the sun isn\'t strong enough \u2014 this page is served from the grid.</em> PV at ' + d.pv_w + 'W, battery at ' + d.soc + '%.';
        }
        about.style.display = 'block';
      }
    })
    .catch(function() {});
})();
