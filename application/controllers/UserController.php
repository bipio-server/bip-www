<?php

class UserController extends Zend_Controller_Action {

    public function init() {
        $this->getResponse()->setHeader('Access-Control-Allow-Origin', '*');

        $this->_session = Zend_Registry::get('default');

        $this->view->authed = ($this->_session->authed == 1);
        $this->view->authUser = $this->_session->authUser;
    }

	public function indexAction() {
		$this->view->page = 'profile';

		$request = $this->getRequest();
		$fc = Zend_Controller_Front::getInstance();
		$this->_db = $fc->getParam('bootstrap')->getResource('mongo');

    	$users = $this->_db->selectCollection('accounts');
    	$shares = $this->_db->selectCollection('bip_shares');

    	$user = $users->findOne(array('username' => $request->getParam('username')));
    	$userShares = $shares->find(array('owner_id' => $user['id']));

    	$this->view->options = Zend_Registry::get('config')->toArray();
    	$this->view->user = $user;
    	$this->view->userShares = $userShares;
    	$this->_authDAO = new Bip_DAO_Auth();

        list(
            $this->view->generalStats,
            $this->view->chordChannels,
            $this->view->chordMatrix) = $this->_authDAO->getAllStats($user['id']);
	}
}