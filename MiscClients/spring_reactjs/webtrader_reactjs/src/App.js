
// DistributedATS - Mike Kipnis (c) 2022
import logo from './logo.svg';
import './App.css';
import Login from './components/Login';
import PositionsAndMarketData from './components/PositionsAndMarketData';
import Ticket from './components/Ticket';
import History from './components/History';
import SessionStateWrapper from './components/SessionStateWrapper';
import React from 'react';
import { useEffect, useState, useMemo } from 'react';


const { forwardRef, useRef, useImperativeHandle } = React;

function App()
{
  const ticketRef = React.useRef();
  const histRef = React.useRef();
  const marketDataAndPositionsRef = React.useRef();

  const url = "http://localhost:8080/";

  const last_sequence_number = useRef(0); // sequence number between front-end and rest controller
  const last_session_state = useRef(null);

  const [sessionToken, setSessionToken] = useState(null);
  const [sessionState, setSessionState] = useState(null);
  const [ticketState, setTicketState] = useState({instrumentName:"N/A",price:0,quantity:0,username:"",token:""});
  const [loginState, setLoginState] = useState({sessionStateCode:0,text:"Please login"});
  const [blotterData, setBlotterData] = useState([]);
  const [orderCancelData, setOrderCancelData] = useState({});
  const [histData, setHistData] = useState([]);

  const Logon_callback = (logon_value) =>
  {
    const requestOptionsResults = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logon_value) };
    fetch(url + '/Login', requestOptionsResults) .then(res => res.json())
    .then(result => setSessionToken(result))
    .catch(err => {

        var invalid_state = {};
        invalid_state["text"] = 'Unable to connect to the server';
        setLoginState(invalid_state);

      });
  }

  const Populate_ticket = ( ticket_data ) =>
  {
      ticket_data.url = url;

      if ( last_session_state.current !== null )
      {
        ticket_data.token = last_session_state.current.token;
        ticket_data.username = last_session_state.current.username;
      }

      setTicketState( ticket_data );
  }

  const Submit_cancel = (cancel_order) =>
  {
    var cancel_out = {};

    cancel_out["token"] = last_session_state.current.token;
    cancel_out["username"] = last_session_state.current.username;
    cancel_out["side"] = cancel_order.side;
    cancel_out["orderKey"] = cancel_order.orderKey;
    cancel_out["securityExchange"] = cancel_order.securityExchange;
    cancel_out["symbol"] = cancel_order.symbol;

    const requestOptionsResults = { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cancel_out) };
    fetch(url + '/CancelOrder', requestOptionsResults) .then(res => res.json())
    .then(result => setOrderCancelData(result))
    .catch(err => {console.log(err)});
  }

  useEffect(() => {
    console.log("Hist Data : " + histData );
  },[histData]);

  useEffect(() => {
    console.log("Order Cancel Data : " + orderCancelData );;
  },[orderCancelData]);

  useEffect(() => {

    if ( sessionToken !== null )
    {
        console.log("sessionToken : " + sessionToken.token);

        var session_state_request = {};
        session_state_request["token"] = sessionToken.Token;
        session_state_request["stateMask"] = 0;
        session_state_request["maxOrderSequenceNumber"] = 0;
        session_state_request["marketDataSequenceNumber"] = 0;

        ticketState.username = sessionToken.username;
        ticketState.token =  sessionToken.Token;;

        var instrument = {};

        var instrument_array = [];
        session_state_request["activeSecurityList"] = instrument_array;

        const requestOptionsResults = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session_state_request) };
        fetch(url + '/SessionState', requestOptionsResults) .then(res => res.json())
        .then(result => setSessionState(result))
        .catch(err => {
          var invalid_state = {};
          invalid_state["text"] = 'Disconnected from the server';
          setLoginState(invalid_state);
          setSessionState(null);
        });
    }

  }, [sessionToken]);

  useEffect(() => {

    if ( sessionState !== null  )
    {
      last_session_state.current = sessionState;

      var session_state_request = {};
      session_state_request["token"] = sessionToken.Token;

      const session_state_wrapper = new SessionStateWrapper(sessionState, session_state_request);

      setLoginState(session_state_wrapper.get_logon_state());

      var blotter_data = session_state_wrapper.get_market_data_and_positions();

      setBlotterData(blotter_data);
      marketDataAndPositionsRef.current.update_data();

      setHistData(session_state_wrapper.get_hist_data(histData, last_sequence_number));

      if ( sessionState.sessionState != 3 )
      {
        const intervalId = setInterval(() => {
                const requestOptionsResults = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session_state_request) };
                fetch(url + '/SessionState', requestOptionsResults) .then(res => res.json())
                .then(result => setSessionState(result))
                .catch(err => {
                  var invalid_state = {};
                  invalid_state["text"] = 'Disconnected from the server';
                  setLoginState(invalid_state);
                  setSessionState(null);
                });
              }, 500)

              return () => {
                clearInterval(intervalId);
              }
        } else {

        }
    } else {
      console.log("Session State is Null");
    }

  }, [sessionState]);

  return (
    <div className="App">
      <nav>
        <Login loginState={loginState} logonCallback={Logon_callback} sessionState={sessionState}/>
      </nav>
      <div style={ ( sessionState == null || sessionState.sessionState != 1 ) ? {pointerEvents: "none", opacity: "0.4"} : {}}>
      <div>
        <PositionsAndMarketData blotterData={blotterData} ticketState={ticketState} marketDataCallback={Populate_ticket} ref={marketDataAndPositionsRef}/>
      </div>
      <div>
        <Ticket ticketState={ticketState} ref={ticketRef}/>
      </div>
      <div>
        <History histData={histData} ref={histRef} orderCancelCallback={Submit_cancel}/>
      </div>
      </div>
    </div>
  );
}

export default App;
