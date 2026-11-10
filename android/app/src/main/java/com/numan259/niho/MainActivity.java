package com.numan259.niho;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NihoDownloadsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
