import React from 'react';

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <span className="toggle__label">{label}</span>
      <div className="toggle__switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle__slider" />
      </div>
    </label>
  );
}

export default function Settings({ settings, onToggle }) {
  return (
    <section className="settings">
      <h2>Settings</h2>
      <Toggle
        label="Auto-betting"
        checked={settings.autoBetting}
        onChange={(val) => onToggle('autoBetting', val)}
      />
      <Toggle
        label="Notifications"
        checked={settings.notifications}
        onChange={(val) => onToggle('notifications', val)}
      />
    </section>
  );
}
