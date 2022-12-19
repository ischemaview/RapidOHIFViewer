import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  SidePanel,
  ErrorBoundary,
  UserPreferences,
  AboutModal,
  Header,
  useModal,
  LoadingIndicatorProgress,
} from '@ohif/ui';

import i18n from '@ohif/i18n';
import { hotkeys } from '@ohif/core';
import { useAppConfig } from '@state';
import Toolbar from '../Toolbar/Toolbar';

const { availableLanguages, defaultLanguage, currentLanguage } = i18n;

function ViewerLayout({
  // From Extension Module Params
  extensionManager,
  servicesManager,
  hotkeysManager,
  commandsManager,
  // From Modes
  leftPanels,
  rightPanels,
  leftPanelDefaultClosed,
  rightPanelDefaultClosed,
  viewports,
  ViewportGridComp,
  leftPanels = [],
  rightPanels = [],
  leftPanelDefaultClosed = false,
  rightPanelDefaultClosed = false,
  disableHeader = false,
  viewerLayoutHeight = 'calc(100vh - 52px)',
}) {
  const [appConfig] = useAppConfig();
  const navigate = useNavigate();

  const onClickReturnButton = () => {
    let query = new URLSearchParams(window.location.search)
    let configUrl = query.get('configUrl')
    if(configUrl){
      let newQuery = new URLSearchParams();
      newQuery.append('configUrl', configUrl)
      navigate(`/?${decodeURIComponent(newQuery.toString())}`);
    } else {
      navigate('/');
    }
  };

  const { t } = useTranslation();
  const { show, hide } = useModal();

  const [showLoadingIndicator, setShowLoadingIndicator] = useState(
    appConfig.showLoadingIndicator
  );

  const { HangingProtocolService } = servicesManager.services;

  const { hotkeyDefinitions, hotkeyDefaults } = hotkeysManager;
  const versionNumber = process.env.VERSION_NUMBER;
  const buildNumber = process.env.BUILD_NUM;

  const menuOptions = [
    {
      title: t('Header:About'),
      icon: 'info',
      onClick: () =>
        show({
          content: AboutModal,
          title: 'About Gradient OHIF Viewer',
          contentProps: { versionNumber, buildNumber },
        }),
    },
    {
      title: t('Header:Preferences'),
      icon: 'settings',
      onClick: () =>
        show({
          title: t('UserPreferencesModal:User Preferences'),
          content: UserPreferences,
          contentProps: {
            hotkeyDefaults: hotkeysManager.getValidHotkeyDefinitions(
              hotkeyDefaults
            ),
            hotkeyDefinitions,
            currentLanguage: currentLanguage(),
            availableLanguages,
            defaultLanguage,
            onCancel: () => {
              hotkeys.stopRecord();
              hotkeys.unpause();
              hide();
            },
            onSubmit: ({ hotkeyDefinitions, language }) => {
              i18n.changeLanguage(language.value);
              hotkeysManager.setHotkeys(hotkeyDefinitions);
              hide();
            },
            onReset: () => hotkeysManager.restoreDefaultBindings(),
            hotkeysModule: hotkeys,
          },
        }),
    },
  ];

  if (appConfig.oidc) {
    menuOptions.push({
      title: t('Header:Logout'),
      icon: 'power-off',
      onClick: async () => {
        navigate(
          `/logout?redirect_uri=${encodeURIComponent(window.location.href)}`
        );
      },
    });
  }

  /**
   * Set body classes (tailwindcss) that don't allow vertical
   * or horizontal overflow (no scrolling). Also guarantee window
   * is sized to our viewport.
   */
  useEffect(() => {
    document.body.classList.add('bg-black');
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('bg-black');
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  const getComponent = id => {
    const entry = extensionManager.getModuleEntry(id);

    if (!entry) {
      throw new Error(
        `${id} is not a valid entry for an extension module, please check your configuration or make sure the extension is registered.`
      );
    }

    let content;
    if (entry && entry.component) {
      content = entry.component;
    } else {
      throw new Error(
        `No component found from extension ${id}. Check the reference string to the extension in your Mode configuration`
      );
    }

    return { entry, content };
  };

  const getPanelData = id => {
    const { content, entry } = getComponent(id);

    return {
      iconName: entry.iconName,
      iconLabel: entry.iconLabel,
      label: entry.label,
      name: entry.name,
      content,
    };
  };

  useEffect(() => {
    const { unsubscribe } = HangingProtocolService.subscribe(
      HangingProtocolService.EVENTS.HANGING_PROTOCOL_APPLIED_FOR_VIEWPORT,

      // Todo: right now to set the loading indicator to false, we need to wait for the
      // HangingProtocolService to finish applying the viewport matching to each viewport,
      // however, this might not be the only approach to set the loading indicator to false. we need to explore this further.
      ({ progress }) => {
        if (progress === 100) {
          setShowLoadingIndicator(false);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [HangingProtocolService]);

  const getViewportComponentData = viewportComponent => {
    const { entry } = getComponent(viewportComponent.namespace);

    return {
      component: entry.component,
      displaySetsToDisplay: viewportComponent.displaySetsToDisplay,
    };
  };

  const leftPanelComponents = leftPanels.map(getPanelData);
  const rightPanelComponents = rightPanels.map(getPanelData);
  const viewportComponents = viewports.map(getViewportComponentData);

  return (
    <div>
      {!disableHeader && (
        <Header
          menuOptions={menuOptions}
          onClickReturnButton={onClickReturnButton}
          WhiteLabeling={appConfig.whiteLabeling}
        >
          <ErrorBoundary context="Primary Toolbar">
            <div className="relative flex justify-center">
              <Toolbar servicesManager={servicesManager} />
            </div>
          </ErrorBoundary>
        </Header>
      )}
      <div
        className="bg-black flex flex-row items-stretch w-full overflow-hidden flex-nowrap relative"
        style={{ height: viewerLayoutHeight }}
      >
        {/* LEFT SIDEPANELS */}
        {leftPanelComponents.length ? (
          <ErrorBoundary context="Left Panel">
            <SidePanel
              side="left"
              defaultComponentOpen={
                leftPanelDefaultClosed ? null : leftPanelComponents[0].name
              }
              childComponents={leftPanelComponents}
            />
          </ErrorBoundary>
        ) : null}
        {/* TOOLBAR + GRID */}
        <div className="flex flex-col flex-1 h-full">
          <div className="flex items-center justify-center flex-1 h-full overflow-hidden bg-black">
            <ErrorBoundary context="Grid">
              <ViewportGridComp
                servicesManager={servicesManager}
                viewportComponents={viewportComponents}
                commandsManager={commandsManager}
              />
            </ErrorBoundary>
          ) : null}
          {/* TOOLBAR + GRID */}
          <div className="flex flex-col flex-1 h-full">
            <div className="flex items-center justify-center flex-1 h-full overflow-hidden bg-black relative">
              <ErrorBoundary context="Grid">
                <ViewportGridComp
                  servicesManager={servicesManager}
                  viewportComponents={viewportComponents}
                  commandsManager={commandsManager}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>
        {rightPanelComponents.length ? (
          <ErrorBoundary context="Right Panel">
            <SidePanel
              side="right"
              defaultComponentOpen={
                rightPanelDefaultClosed ? null : rightPanelComponents[0].name
              }
              childComponents={rightPanelComponents}
            />
          </ErrorBoundary>
        ) : null}
      </div>
    </div>
  );
}

ViewerLayout.propTypes = {
  // From extension module params
  extensionManager: PropTypes.shape({
    getModuleEntry: PropTypes.func.isRequired,
  }).isRequired,
  commandsManager: PropTypes.object,
  // From modes
  leftPanels: PropTypes.array,
  rightPanels: PropTypes.array,
  leftPanelDefaultClosed: PropTypes.bool.isRequired,
  rightPanelDefaultClosed: PropTypes.bool.isRequired,
  /** Responsible for rendering our grid of viewports; provided by consuming application */
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
};

ViewerLayout.defaultProps = {
  leftPanels: [],
  rightPanels: [],
  leftPanelDefaultClosed: false,
  rightPanelDefaultClosed: false,
};

export default ViewerLayout;
