-- Create user alert configurations table
CREATE TABLE IF NOT EXISTS user_alert_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument_token BIGINT NOT NULL,
  instrument_name TEXT NOT NULL,
  exchange TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  deviation DECIMAL(10,4) DEFAULT 0.1,
  duration INTEGER DEFAULT 30, -- in seconds
  respect_market_hours BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  notification_browser BOOLEAN DEFAULT true,
  notification_email BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, instrument_token)
);

-- Create alert logs table
CREATE TABLE IF NOT EXISTS user_alert_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument_token BIGINT NOT NULL,
  instrument_name TEXT NOT NULL,
  exchange TEXT NOT NULL,
  alert_type TEXT NOT NULL, -- 'inactivity', 'price_change', 'volume_spike', etc.
  alert_data JSONB NOT NULL, -- Store alert-specific data
  baseline_price DECIMAL(15,4),
  current_price DECIMAL(15,4),
  price_range JSONB, -- {min: number, max: number}
  deviation DECIMAL(10,4),
  duration INTEGER,
  market_session TEXT,
  market_type TEXT,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user alert preferences table
CREATE TABLE IF NOT EXISTS user_alert_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  global_sound_enabled BOOLEAN DEFAULT true,
  global_browser_notifications BOOLEAN DEFAULT true,
  global_email_notifications BOOLEAN DEFAULT false,
  sound_volume DECIMAL(3,2) DEFAULT 0.5, -- 0.0 to 1.0
  alert_frequency_limit INTEGER DEFAULT 5, -- max alerts per minute
  auto_acknowledge_after INTEGER DEFAULT 300, -- seconds
  dashboard_alert_display BOOLEAN DEFAULT true,
  alert_history_retention_days INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_alert_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alert_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alert_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_alert_configs
CREATE POLICY "Users can view their own alert configs" ON user_alert_configs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert configs" ON user_alert_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert configs" ON user_alert_configs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alert configs" ON user_alert_configs
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_alert_logs
CREATE POLICY "Users can view their own alert logs" ON user_alert_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert logs" ON user_alert_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert logs" ON user_alert_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for user_alert_preferences
CREATE POLICY "Users can view their own alert preferences" ON user_alert_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert preferences" ON user_alert_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert preferences" ON user_alert_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_user_alert_configs_user_id ON user_alert_configs(user_id);
CREATE INDEX idx_user_alert_configs_instrument ON user_alert_configs(instrument_token);
CREATE INDEX idx_user_alert_logs_user_id ON user_alert_logs(user_id);
CREATE INDEX idx_user_alert_logs_created_at ON user_alert_logs(created_at DESC);
CREATE INDEX idx_user_alert_logs_instrument ON user_alert_logs(instrument_token);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_alert_configs_updated_at 
  BEFORE UPDATE ON user_alert_configs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_alert_preferences_updated_at 
  BEFORE UPDATE ON user_alert_preferences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default preferences for existing users
INSERT INTO user_alert_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
