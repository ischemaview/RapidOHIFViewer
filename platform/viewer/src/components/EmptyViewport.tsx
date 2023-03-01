import React from 'react';
import classNames from 'classnames';

function EmptyViewport(props) {
  return (
    <div
      className={classNames(
        'absolute z-50 top-0 left-0 flex flex-col items-center justify-center space-y-5',
        props.className
      )}
    >
      <div className="failed items-center flex flex-col">
        <div className="box-48-horizontal">
          <rapid-icon-button
            icon="refresh-48"
            class="medium"
          ></rapid-icon-button>
        </div>
        <span className="message">Reload</span>
        <span className="sub-message">Images failed to download</span>
      </div>
    </div>
  );
}

export default EmptyViewport;
