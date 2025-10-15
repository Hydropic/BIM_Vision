import {FC} from "react";
import { IconCube } from '../Icons';

const Header: FC = () => {
  return (
    <div style={{ background: 'white', padding: '16px 20px', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: '#3b82f6', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconCube width={20} height={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1f2937', margin: 0 }}>ArchVision</h1>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>BIM Rule Validation Platform</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ padding: '4px 8px', background: '#dcfce7', color: '#16a34a', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>Connected</div>
          <div style={{ padding: '4px 8px', background: '#f3f4f6', color: '#6b7280', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>v1.0.0</div>
        </div>
      </div>
    </div>
  );
};

export default Header;
